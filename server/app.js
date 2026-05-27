// VC Issuer & Verifier — Main Express Application
const express = require('express');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const msal = require('@azure/msal-node');
const fs = require('fs');

// Load configuration
const configPath = path.join(__dirname, '..', 'appsettings.json');
if (!fs.existsSync(configPath)) {
  console.error('ERROR: appsettings.json not found. Copy appsettings.example.json and fill in your values.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// MSAL configuration for user sign-in (OIDC)
const msalConfig = {
  auth: {
    clientId: config.azClientId,
    authority: `https://login.microsoftonline.com/${config.azTenantId}`,
    clientSecret: config.azClientSecret
  },
  system: {
    loggerOptions: {
      logLevel: msal.LogLevel.Warning
    }
  }
};

const msalClient = new msal.ConfidentialClientApplication(msalConfig);

// MSAL client credentials for VC Request API
const msalClientCredentialRequest = {
  scopes: ['3db474b9-6a0c-4840-96ac-1fceb342124f/.default']
};

// In-memory request state store (expires entries after 5 min)
const requestStore = new Map();
const REQUEST_TTL = 5 * 60 * 1000;

function storeRequest(id, data) {
  requestStore.set(id, { ...data, timestamp: Date.now() });
}

function getRequest(id) {
  const entry = requestStore.get(id);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > REQUEST_TTL) {
    requestStore.delete(id);
    return null;
  }
  return entry;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of requestStore) {
    if (now - entry.timestamp > REQUEST_TTL) {
      requestStore.delete(id);
    }
  }
}, 60 * 1000);

// Express app
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: config.azClientSecret || uuidv4(),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 30 * 60 * 1000 }
}));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  // For API calls return 401, for pages redirect to login
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login');
}

// ─── Auth Routes ───────────────────────────────────────────────

app.get('/auth/login', (req, res) => {
  const redirectUri = `${getBaseUrl(req)}/auth/callback`;
  const authUrl = msalClient.getAuthCodeUrl({
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    redirectUri,
    prompt: 'select_account'
  }).then(url => res.redirect(url))
    .catch(err => {
      console.error('Auth URL error:', err);
      res.status(500).send('Authentication error');
    });
});

app.get('/auth/callback', async (req, res) => {
  const redirectUri = `${getBaseUrl(req)}/auth/callback`;
  try {
    const tokenResponse = await msalClient.acquireTokenByCode({
      code: req.query.code,
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri
    });

    // Store user info in session
    req.session.user = {
      name: tokenResponse.account.name,
      username: tokenResponse.account.username,
      oid: tokenResponse.account.localAccountId,
      tenantId: tokenResponse.account.tenantId
    };
    req.session.accessToken = tokenResponse.accessToken;

    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error('Token acquisition error:', err);
    res.status(500).send('Authentication failed');
  }
});

app.get('/auth/logout', (req, res) => {
  const postLogoutUri = getBaseUrl(req);
  req.session.destroy(() => {
    res.redirect(`https://login.microsoftonline.com/${config.azTenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutUri)}`);
  });
});

// ─── User Info API ─────────────────────────────────────────────

app.get('/api/user', requireAuth, (req, res) => {
  res.json({
    user: req.session.user,
    config: {
      clientName: config.clientName,
      didAuthority: config.DidAuthority,
      showInfoBanner: config.showInfoBanner,
      credentials: config.credentials.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        icon: c.icon,
        hasPhoto: c.hasPhoto,
        credentialType: c.credentialType,
        pinCode: c.pinCode
      }))
    }
  });
});

// ─── Health Endpoint ───────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ─── Status Polling ────────────────────────────────────────────

app.get('/api/status/:id', requireAuth, (req, res) => {
  const data = getRequest(req.params.id);
  if (!data) {
    return res.status(404).json({ error: 'Request not found or expired' });
  }
  res.json({ status: data.status, message: data.message, payload: data.payload || null });
});

// ─── Callback (VC Service → this app) ─────────────────────────

app.post('/api/callback', (req, res) => {
  const body = req.body;
  console.log('Callback received:', JSON.stringify(body, null, 2));

  // Validate API key
  const apiKey = req.headers['api-key'];
  if (apiKey !== config.azClientSecret) {
    console.warn('Invalid callback API key');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const requestId = body.state;
  if (!requestId) {
    return res.status(400).json({ error: 'Missing state' });
  }

  const existing = getRequest(requestId);
  if (!existing) {
    console.warn('Callback for unknown request:', requestId);
    return res.status(404).json({ error: 'Unknown request' });
  }

  const code = body.requestStatus || body.code;

  if (code === 'request_retrieved') {
    storeRequest(requestId, { ...existing, status: 'request_retrieved', message: 'QR code scanned. Complete the process in Authenticator.' });
  } else if (code === 'issuance_successful') {
    storeRequest(requestId, { ...existing, status: 'issuance_successful', message: 'Credential issued successfully!' });
  } else if (code === 'presentation_verified') {
    const claims = body.verifiedCredentialsData || [];
    storeRequest(requestId, {
      ...existing,
      status: 'presentation_verified',
      message: 'Credential verified successfully!',
      payload: { verifiedCredentials: claims }
    });
  } else if (code === 'issuance_error' || code === 'presentation_error') {
    const errorMsg = body.error ? `${body.error.code}: ${body.error.message}` : 'An error occurred';
    storeRequest(requestId, { ...existing, status: 'error', message: errorMsg });
  } else {
    storeRequest(requestId, { ...existing, status: code || 'unknown', message: body.message || 'Status updated' });
  }

  res.status(200).json({ message: 'OK' });
});

// ─── Page Routes (serve HTML with auth) ────────────────────────

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/issue', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'issue.html'));
});

app.get('/verify', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'verify.html'));
});

// Mount route modules
const issuerRoutes = require('./issuer');
const verifierRoutes = require('./verifier');
const graphRoutes = require('./graph');

app.use('/api/issue', requireAuth, issuerRoutes(config, msalClient, msalClientCredentialRequest, storeRequest, getRequest, getBaseUrl));
app.use('/api/verify', requireAuth, verifierRoutes(config, msalClient, msalClientCredentialRequest, storeRequest, getRequest, getBaseUrl));
app.use('/api/graph', requireAuth, graphRoutes(config, msalClient));

// ─── Error Handler ─────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(500).sendFile(path.join(__dirname, '..', 'public', 'error.html'));
});

// ─── Utility ───────────────────────────────────────────────────

function getBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${host}`;
}

// ─── Start Server ──────────────────────────────────────────────

const port = process.env.PORT || config.port || 8080;
app.listen(port, () => {
  console.log(`VC Issuer & Verifier running on port ${port}`);
  console.log(`DID Authority: ${config.DidAuthority}`);
  console.log(`Credentials configured: ${config.credentials.length}`);
});

module.exports = { app, config, msalClient, msalClientCredentialRequest, storeRequest, getRequest, getBaseUrl };
