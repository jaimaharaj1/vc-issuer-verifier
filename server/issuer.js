// Issuance Routes
const { v4: uuidv4 } = require('uuid');
const https = require('https');

module.exports = function (config, msalClient, msalClientCredentialRequest, storeRequest, getRequest, getBaseUrl) {
  const router = require('express').Router();

  // Create issuance request
  router.post('/request', async (req, res) => {
    const { credentialId, photoSource, photoData, pin } = req.body;

    // Find credential config
    const credConfig = config.credentials.find(c => c.id === credentialId);
    if (!credConfig) {
      return res.status(400).json({ error: 'Unknown credential type' });
    }

    // Get access token for VC API
    let accessToken;
    try {
      const result = await msalClient.acquireTokenByClientCredential(msalClientCredentialRequest);
      accessToken = result.accessToken;
    } catch (err) {
      console.error('Failed to get VC API access token:', err);
      return res.status(500).json({ error: 'Failed to acquire access token' });
    }

    const requestId = uuidv4();
    const user = req.session.user;

    // Build claims for idTokenHint
    const claims = {
      given_name: user.name ? user.name.split(' ')[0] : '',
      family_name: user.name ? user.name.split(' ').slice(1).join(' ') : '',
      DisplayName: user.name || '',
      UserPrincipalName: user.username || '',
      oid: user.oid || ''
    };

    // Handle photo if credential supports it
    if (credConfig.hasPhoto && photoSource) {
      let photoBase64 = null;

      if (photoSource === 'entra' && photoData) {
        // Photo already fetched via /api/graph/photo and passed as base64
        photoBase64 = photoData;
      } else if (photoSource === 'upload' && photoData) {
        // Uploaded file as base64 data URL — strip prefix
        photoBase64 = photoData.replace(/^data:image\/\w+;base64,/, '');
      }

      if (photoBase64) {
        claims[credConfig.photoClaimName || 'photo'] = photoBase64;
      }
    }

    // Build issuance request payload
    const callbackUrl = `${getBaseUrl(req)}/api/callback`;
    const issuancePayload = {
      includeQRCode: true,
      callback: {
        url: callbackUrl,
        state: requestId,
        headers: {
          'api-key': config.azClientSecret
        }
      },
      authority: config.DidAuthority,
      registration: {
        clientName: config.clientName
      },
      type: 'VerifiableCredential,'+credConfig.credentialType,
      manifest: credConfig.manifestUrl,
      claims: claims
    };

    // Add PIN if enabled
    if (credConfig.pinCode && credConfig.pinCode.enabled) {
      const pinLength = credConfig.pinCode.length || 4;
      const generatedPin = pin || generatePin(pinLength);
      issuancePayload.pin = { length: pinLength, value: generatedPin };
    }

    console.log('Issuance request:', JSON.stringify(issuancePayload, null, 2));

    // Call VC Request API
    try {
      const apiUrl = 'https://verifiedid.did.msidentity.com/v1.0/verifiableCredentials/createIssuanceRequest';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(issuancePayload)
      });

      const result = await response.json();

      if (response.status > 299) {
        console.error('VC API error:', result);
        const errMsg = result.error
          ? `${result.error.code || ''}: ${result.error.message || ''} ${result.error.innererror?.message || ''}`
          : 'Unknown error from VC service';
        return res.status(400).json({ error: errMsg });
      }

      // Store initial state
      storeRequest(requestId, {
        status: 'request_created',
        message: 'Scan the QR code with Microsoft Authenticator',
        type: 'issuance'
      });

      // Return QR code URL and request ID to frontend
      res.json({
        requestId,
        url: result.url,
        qrCode: result.qrCode,
        expiry: result.expiry,
        pin: issuancePayload.pin ? issuancePayload.pin.value : null
      });

    } catch (err) {
      console.error('Issuance request failed:', err);
      res.status(500).json({ error: 'Failed to create issuance request' });
    }
  });

  return router;
};

function generatePin(length) {
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}
