// Microsoft Graph API — Photo fetch
const https = require('https');

module.exports = function (config, msalClient) {
  const router = require('express').Router();

  // Fetch user's photo from Entra ID via Graph API
  router.get('/photo', async (req, res) => {
    const user = req.session.user;
    if (!user || !user.oid) {
      return res.status(400).json({ error: 'User OID not available' });
    }

    try {
      // Get Graph API token using client credentials
      const result = await msalClient.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default']
      });

      const graphUrl = `https://graph.microsoft.com/v1.0/users/${user.oid}/photo/$value`;
      const response = await fetch(graphUrl, {
        headers: { 'Authorization': `Bearer ${result.accessToken}` }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'No photo found for this user in Entra ID' });
        }
        return res.status(response.status).json({ error: 'Failed to fetch photo from Graph API' });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const base64Photo = buffer.toString('base64');

      res.json({
        photo: base64Photo,
        size: buffer.length,
        contentType: 'image/jpeg'
      });

    } catch (err) {
      console.error('Graph photo fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch photo' });
    }
  });

  return router;
};
