# VC Issuer & Verifier

A lightweight, elegant app for issuing and verifying **Microsoft Entra Verified ID** credentials, with FaceCheck (facial recognition) support.

Built with Node.js + Express and a dark glassmorphism UI. Designed for easy configuration and deployment to Azure App Service.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Azure](https://img.shields.io/badge/Deploy-Azure_App_Service-blue)

## Features

- **Credential Issuance** — Issue multiple credential types from a single app
- **Photo Support** — Include photos from Entra ID (Graph API) or file upload
- **FaceCheck Verification** — Liveness detection with facial recognition
- **Real-time Status** — Live status updates during issuance and verification
- **QR Code + Deep Link** — QR for desktop, deep link for mobile
- **PIN Code** — Optional PIN per credential for added security
- **Multi-credential** — Configure as many credential types as needed via `appsettings.json`
- **Dark Glassmorphism UI** — Modern, elegant interface

---

## Prerequisites

1. **Azure tenant** with Verified ID enabled
2. **Entra ID app registration** with:
   - `Application (client) ID`
   - `Client secret`
   - Redirect URI: `https://<your-app-url>/auth/callback`
   - API permissions:
     - `User.Read` (delegated) — for user sign-in
     - `User.Read.All` (application) — for photo fetch from Graph API (admin-consented)
3. **Verified ID credential** with rules and display definitions configured
4. **Linked domain** verified and published to your DID

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/jaimaharaj1/vc-issuer-verifier.git
cd vc-issuer-verifier
npm install
```

### 2. Configure

Copy and edit `appsettings.json`:

```json
{
  "azTenantId": "your-tenant-id",
  "azClientId": "your-client-id",
  "azClientSecret": "your-client-secret",
  "DidAuthority": "did:web:yourdomain.com",
  "clientName": "My VC App",
  "purpose": "Issue and verify credentials",
  "showInfoBanner": true,
  "port": 8080,
  "credentials": [ ... ],
  "faceCheck": { ... }
}
```

### 3. Run locally

```bash
npm start
```

Navigate to `http://localhost:8080`

> **Note:** For local development, you'll need a public URL for callbacks. Use a tool like [ngrok](https://ngrok.com/) or [devtunnels](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/overview).

---

## Configuration Reference

### Top-level settings

| Setting | Description | Required |
|---------|-------------|----------|
| `azTenantId` | Your Entra ID tenant ID | Yes |
| `azClientId` | App registration client ID | Yes |
| `azClientSecret` | App registration client secret | Yes |
| `DidAuthority` | Your DID (e.g. `did:web:yourdomain.com`) | Yes |
| `clientName` | Display name shown in Authenticator during issuance/verification | Yes |
| `purpose` | Purpose text shown during verification | Yes |
| `showInfoBanner` | Show admin info banner with DID and tenant info (true/false) | No |
| `port` | Server port (default: 8080) | No |

### Credential configuration

Each entry in the `credentials` array:

| Setting | Description | Required |
|---------|-------------|----------|
| `id` | Unique slug identifier (e.g. `osha-certified`) | Yes |
| `name` | Display name shown in the UI | Yes |
| `description` | Short description | Yes |
| `icon` | Icon name: `shield-check`, `briefcase`, `award`, `user-check`, `file-check` | No |
| `credentialType` | Exact type from your rules definition | Yes |
| `manifestUrl` | Full manifest URL from Verified ID portal | Yes |
| `hasPhoto` | Whether this credential includes a photo claim | No |
| `photoClaimName` | Name of the photo output claim (default: `photo`) | If hasPhoto |
| `pinCode.enabled` | Require PIN during issuance | No |
| `pinCode.length` | PIN digit count (default: 4) | No |

### FaceCheck configuration

```json
"faceCheck": {
  "defaultEnabled": false,
  "matchConfidenceThreshold": 70
}
```

| Setting | Description |
|---------|-------------|
| `defaultEnabled` | Pre-toggle FaceCheck on the verify page |
| `matchConfidenceThreshold` | Confidence threshold (50-99, default 70) |

---

## Adding a New Credential

1. **Create the credential** in the Entra admin portal (Verified ID → Credentials)
2. **Add an entry** to `credentials` in `appsettings.json`:

```json
{
  "id": "verified-employee",
  "name": "Verified Employee",
  "description": "Proves current employment status",
  "icon": "briefcase",
  "credentialType": "VerifiedEmployee",
  "manifestUrl": "https://verifiedid.did.msidentity.com/v1.0/tenants/<tenant-id>/verifiableCredentials/contracts/<contract>/manifest",
  "hasPhoto": false,
  "pinCode": { "enabled": false, "length": 4 }
}
```

3. **Restart** the app — the new credential appears automatically.

---

## Credential Definitions

### Rules Definition (with photo)

```json
{
  "attestations": {
    "idTokenHints": [
      {
        "mapping": [
          { "outputClaim": "DisplayName", "required": true, "inputClaim": "$.DisplayName", "indexed": false },
          { "outputClaim": "firstName", "required": true, "inputClaim": "$.given_name", "indexed": false },
          { "outputClaim": "lastName", "required": true, "inputClaim": "$.family_name", "indexed": false },
          { "outputClaim": "UserPrincipalName", "required": true, "inputClaim": "$.UserPrincipalName", "indexed": false },
          { "outputClaim": "photo", "required": false, "inputClaim": "$.photo", "indexed": false }
        ],
        "required": false
      }
    ]
  },
  "validityInterval": 2592000,
  "vc": {
    "type": ["OSHACertified"]
  }
}
```

### Display Definition (with photo)

```json
{
  "locale": "en-US",
  "card": {
    "backgroundColor": "#1a1a2e",
    "description": "Your credential description",
    "issuedBy": "Your Organisation",
    "textColor": "#ffffff",
    "title": "Credential Title",
    "logo": {
      "description": "Logo",
      "uri": "https://your-logo-url.png"
    }
  },
  "consent": {
    "instructions": "This credential proves your identity.",
    "title": "Credential Issuance"
  },
  "claims": [
    { "claim": "vc.credentialSubject.DisplayName", "label": "Name", "type": "String" },
    { "claim": "vc.credentialSubject.firstName", "label": "First Name", "type": "String" },
    { "claim": "vc.credentialSubject.lastName", "label": "Last Name", "type": "String" },
    { "claim": "vc.credentialSubject.UserPrincipalName", "label": "Username", "type": "String" },
    { "claim": "vc.credentialSubject.photo", "label": "Photo", "type": "image/jpg;base64url" }
  ]
}
```

> ⚠️ **CRITICAL**: The photo claim `type` MUST be exactly `image/jpg;base64url` (all lowercase). Using `Image/jpg;base64url` (capital I) will cause FaceCheck to fail silently with "You'll have to add this Verified ID first".

---

## Deployment to Azure App Service

### 1. Create App Service

```bash
az webapp create \
  --resource-group <rg-name> \
  --plan <plan-name> \
  --name vc-issuer-verifier \
  --runtime "NODE:18-lts"
```

### 2. Configure app settings

```bash
az webapp config appsettings set \
  --resource-group <rg-name> \
  --name vc-issuer-verifier \
  --settings \
    WEBSITE_NODE_DEFAULT_VERSION="~18" \
    SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

### 3. Deploy

```bash
az webapp deploy \
  --resource-group <rg-name> \
  --name vc-issuer-verifier \
  --src-path ./deploy.zip \
  --type zip
```

### 4. Set redirect URI

In the Azure portal, add `https://vc-issuer-verifier.azurewebsites.net/auth/callback` as a redirect URI in your app registration.

---

## App Registration Setup

1. Go to **Entra admin centre** → **App registrations** → **New registration**
2. Name: `VC Issuer Verifier`
3. Supported account types: **Single tenant**
4. Redirect URI: `https://<your-app>/auth/callback` (Web platform)
5. Under **Certificates & secrets** → create a client secret
6. Under **API permissions**:
   - Add `Microsoft Graph` → `User.Read` (delegated)
   - Add `Microsoft Graph` → `User.Read.All` (application) — only if using Entra ID photo
   - Grant admin consent

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "You'll have to add this Verified ID first" during FaceCheck | Photo claim type has wrong case in display definition | Ensure type is `image/jpg;base64url` (lowercase) |
| "Work or personal" account prompt in Authenticator | Linked domain not verified or `clientName` mismatch | Verify your linked domain is published and `clientName` matches your DID registration |
| Photo not appearing in credential | Photo data encoding issue | Ensure standard base64 (not base64url). The VC service handles encoding internally |
| Callback never arrives | App not publicly accessible | Use ngrok/devtunnels for local dev, or ensure Azure App Service URL is correct |
| 401 from VC API | Token scope incorrect | Ensure scope is `3db474b9-6a0c-4840-96ac-1fceb342124f/.default` |

---

## Known Limitations

- In-memory session store — sessions are lost on app restart (suitable for single-instance deployments)
- Single-tenant only for verification (accepts credentials from your DID only)
- Photo fetch requires `User.Read.All` application permission with admin consent

---

## License

MIT
