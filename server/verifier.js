// Verification Routes
const { v4: uuidv4 } = require('uuid');

module.exports = function (config, msalClient, msalClientCredentialRequest, storeRequest, getRequest, getBaseUrl) {
  const router = require('express').Router();

  // Create presentation request
  router.post('/request', async (req, res) => {
    const { credentialId, faceCheck } = req.body;

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
    const callbackUrl = `${getBaseUrl(req)}/api/callback`;

    // Build presentation request
    const presentationPayload = {
      includeQRCode: true,
      includeReceipt: false,
      authority: config.DidAuthority,
      registration: {
        clientName: config.clientName,
        purpose: config.purpose || 'Verify your credential'
      },
      callback: {
        url: callbackUrl,
        state: requestId,
        headers: {
          'api-key': config.azClientSecret
        }
      },
      requestedCredentials: [
        {
          type: credConfig.credentialType,
          acceptedIssuers: [config.DidAuthority],
          configuration: {
            validation: {
              allowRevoked: false,
              validateLinkedDomain: true
            }
          }
        }
      ]
    };

    // Add FaceCheck if requested and credential has photo
    if (faceCheck && credConfig.hasPhoto) {
      const photoClaimName = credConfig.photoClaimName || 'photo';
      const threshold = config.faceCheck?.matchConfidenceThreshold || 70;
      presentationPayload.requestedCredentials[0].configuration.validation.faceCheck = {
        sourcePhotoClaimName: photoClaimName,
        matchConfidenceThreshold: threshold
      };
    }

    console.log('Presentation request:', JSON.stringify(presentationPayload, null, 2));

    // Determine API endpoint — FaceCheck requires beta
    let apiUrl = 'https://verifiedid.did.msidentity.com/v1.0/verifiableCredentials/createPresentationRequest';
    if (faceCheck && credConfig.hasPhoto) {
      apiUrl = apiUrl.replace('/v1.0/', '/beta/');
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(presentationPayload)
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
        type: 'verification'
      });

      res.json({
        requestId,
        url: result.url,
        qrCode: result.qrCode,
        expiry: result.expiry
      });

    } catch (err) {
      console.error('Presentation request failed:', err);
      res.status(500).json({ error: 'Failed to create presentation request' });
    }
  });

  return router;
};
