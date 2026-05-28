# VC Issuer & Verifier

A lightweight, elegant app for issuing and verifying **Microsoft Entra Verified ID** credentials, with optional **FaceCheck** (facial recognition liveness) support.

Built with Node.js + Express and a dark glassmorphism UI. Designed for easy configuration and deployment to Azure App Service.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Azure](https://img.shields.io/badge/Deploy-Azure_App_Service-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

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

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start Guide](#quick-start-guide)
3. [Step 1: Set Up Verified ID](#step-1-set-up-verified-id)
4. [Step 2: Create Your Credential](#step-2-create-your-credential)
5. [Step 3: Register the App in Entra ID](#step-3-register-the-app-in-entra-id)
6. [Step 4: Configure the App](#step-4-configure-the-app)
7. [Step 5: Deploy to Azure](#step-5-deploy-to-azure)
8. [Step 6: Test End-to-End](#step-6-test-end-to-end)
9. [Configuration Reference](#configuration-reference)
10. [Adding More Credentials](#adding-more-credentials)
11. [Troubleshooting](#troubleshooting)
12. [Contributing](#contributing)

---

## Prerequisites

Before deploying this app, ensure you have:

| Requirement | Details |
|---|---|
| **Azure subscription** | Any Azure subscription with permission to create resources |
| **Entra ID tenant** | The tenant where you'll issue and verify credentials |
| **Verified ID service** | Already set up in your tenant ([Setup guide](https://learn.microsoft.com/en-us/entra/verified-id/verifiable-credentials-configure-tenant)) |
| **Linked domain** | A verified linked domain published to your DID ([Guide](https://learn.microsoft.com/en-us/entra/verified-id/how-to-dnsbind)) |
| **Azure CLI** | Installed and signed in (`az login`) |
| **Node.js 18+** | For local development/testing |
| **Microsoft Authenticator** | Installed on a mobile device for testing |

> **New to Verified ID?** Follow the [Microsoft Learn quickstart](https://learn.microsoft.com/en-us/entra/verified-id/verifiable-credentials-configure-tenant) to set up the service in your tenant first.

---

## Quick Start Guide

If you're already familiar with Verified ID, here's the fast path:

```bash
# 1. Clone
git clone https://github.com/jaimaharaj1/vc-issuer-verifier.git
cd vc-issuer-verifier
npm install

# 2. Copy and edit config
cp appsettings.example.json appsettings.json
# Edit appsettings.json with your values (see Step 4 below)

# 3. Deploy to Azure
az webapp up --name <your-app-name> --runtime "NODE:22-lts" --sku B1

# 4. Set redirect URI in app registration
# Add: https://<your-app-name>.azurewebsites.net/auth/callback
```

For detailed step-by-step instructions, continue below.

---

## Step 1: Set Up Verified ID

> Skip this if Verified ID is already configured in your tenant.

1. Sign in to the [Entra admin centre](https://entra.microsoft.com)
2. Navigate to **Verified ID** → **Setup**
3. Complete the setup wizard:
   - Choose your DID method (recommended: `did:web`)
   - Configure your linked domain
   - Verify domain ownership via DNS TXT record
4. Note your **DID authority** (e.g., `did:web:yourdomain.com`) — you'll need this later

📖 [Full setup guide on Microsoft Learn](https://learn.microsoft.com/en-us/entra/verified-id/verifiable-credentials-configure-tenant)

---

## Step 2: Create Your Credential

You need to create a credential with **rules** and **display** definitions. Below is a sample credential called "Verified Employee" that you can use as-is or customise.

### 2.1 Create the Credential in the Portal

1. In the Entra admin centre, go to **Verified ID** → **Credentials**
2. Click **+ Add credential**
3. Select **Custom credential**
4. Enter a name (e.g., `VerifiedEmployee`)
5. Paste the **display definition** and **rules definition** below

### 2.2 Sample Display Definition

This controls how the credential looks in Microsoft Authenticator:

```json
{
  "locale": "en-US",
  "card": {
    "backgroundColor": "#1a1a2e",
    "description": "Proves that the holder is a verified employee of the organisation.",
    "issuedBy": "Your Organisation Name",
    "textColor": "#ffffff",
    "title": "Verified Employee",
    "logo": {
      "description": "Organisation Logo",
      "uri": "https://your-logo-url.png"
    }
  },
  "consent": {
    "instructions": "This credential verifies your employment status. You will need to present this when requested.",
    "title": "Verified Employee Credential"
  },
  "claims": [
    {
      "claim": "vc.credentialSubject.displayName",
      "label": "Display Name",
      "type": "String"
    },
    {
      "claim": "vc.credentialSubject.firstName",
      "label": "First Name",
      "type": "String"
    },
    {
      "claim": "vc.credentialSubject.lastName",
      "label": "Last Name",
      "type": "String"
    },
    {
      "claim": "vc.credentialSubject.userPrincipalName",
      "label": "Username",
      "type": "String"
    },
    {
      "claim": "vc.credentialSubject.photo",
      "label": "Photo",
      "type": "image/jpg;base64url"
    }
  ]
}
```

### 2.3 Sample Rules Definition

This controls what claims go into the credential and how they're sourced:

```json
{
  "attestations": {
    "idTokenHints": [
      {
        "mapping": [
          {
            "outputClaim": "displayName",
            "required": true,
            "inputClaim": "$.displayName",
            "indexed": false
          },
          {
            "outputClaim": "firstName",
            "required": true,
            "inputClaim": "$.firstName",
            "indexed": false
          },
          {
            "outputClaim": "lastName",
            "required": true,
            "inputClaim": "$.lastName",
            "indexed": false
          },
          {
            "outputClaim": "userPrincipalName",
            "required": true,
            "inputClaim": "$.userPrincipalName",
            "indexed": false
          },
          {
            "outputClaim": "photo",
            "required": false,
            "inputClaim": "$.photo",
            "indexed": false
          }
        ],
        "required": false
      }
    ]
  },
  "validityInterval": 2592000,
  "vc": {
    "type": [
      "VerifiedEmployee"
    ]
  }
}
```

### 2.4 Important Rules

> ⚠️ **Case sensitivity is critical:**
> - The `outputClaim` in the rules definition MUST exactly match the claim path in the display definition
> - Example: if display def has `vc.credentialSubject.displayName`, rules must have `"outputClaim": "displayName"`
> - Mismatched casing causes `?` prefix on labels in Authenticator
>
> ⚠️ **Photo claim type:**
> - The photo claim `type` in the display definition MUST be exactly `image/jpg;base64url` (all lowercase)
> - Using `Image/jpg;base64url` (capital I) will cause FaceCheck verification to fail silently

### 2.5 Note Your Manifest URL

After creating the credential, copy the **manifest URL**. You'll find it on the credential's overview page. It looks like:

```
https://verifiedid.did.msidentity.com/v1.0/tenants/<tenant-id>/verifiableCredentials/contracts/<contract-id>/manifest
```

---

## Step 3: Register the App in Entra ID

### 3.1 Create the App Registration

```bash
# Create the app registration
az ad app create \
  --display-name "VC Issuer Verifier" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "https://<your-app-name>.azurewebsites.net/auth/callback" "http://localhost:8080/auth/callback"
```

Note the `appId` from the output.

### 3.2 Create a Client Secret

```bash
az ad app credential reset --id <app-id> --display-name "App Secret" --years 1
```

Note the `password` — this is your client secret (you won't see it again).

### 3.3 Create a Service Principal

```bash
az ad sp create --id <app-id>
```

### 3.4 Assign API Permissions

The app needs these permissions:

| API | Permission | Type | Purpose |
|-----|-----------|------|---------|
| Microsoft Graph | `User.Read` | Delegated | User sign-in |
| Microsoft Graph | `User.Read.All` | Application | Fetch user photos (optional, only if using photo credentials) |
| Verifiable Credentials Service Request | `VerifiableCredential.Create.All` | Application | Issue and verify credentials |

```bash
# Add Graph permissions
az ad app permission add --id <app-id> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope df021288-bdef-4463-88db-98f22de89214=Role

# Add Verified ID permission
az ad app permission add --id <app-id> \
  --api 3db474b9-6a0c-4840-96ac-1fceb342124f \
  --api-permissions bbb94529-53a3-4be5-a069-7eaf2712b826=Role

# Grant admin consent
az ad app permission admin-consent --id <app-id>
```

If admin consent fails via CLI, grant it in the portal:
1. Go to **App registrations** → your app → **API permissions**
2. Click **Grant admin consent for [tenant]**

### 3.5 Assign Verified ID Roles (if admin-consent didn't work)

```bash
# Get your app's service principal ID
SP_ID=$(az ad sp show --id <app-id> --query id -o tsv)

# Get the Verified ID service principal ID
VC_SP_ID=$(az ad sp list --filter "appId eq '3db474b9-6a0c-4840-96ac-1fceb342124f'" --query "[0].id" -o tsv)

# Assign VerifiableCredential.Create.All role
az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_ID/appRoleAssignments" \
  --body "{\"principalId\":\"$SP_ID\",\"resourceId\":\"$VC_SP_ID\",\"appRoleId\":\"949ebb93-18f8-41b4-b677-c2bfea940027\"}" \
  --headers "Content-Type=application/json"
```

---

## Step 4: Configure the App

### 4.1 Create Your Configuration

```bash
cp appsettings.example.json appsettings.json
```

### 4.2 Fill In Your Values

Edit `appsettings.json`:

```json
{
  "azTenantId": "<YOUR-TENANT-ID>",
  "azClientId": "<YOUR-APP-CLIENT-ID>",
  "azClientSecret": "<YOUR-CLIENT-SECRET>",
  "DidAuthority": "<YOUR-DID e.g. did:web:yourdomain.com>",
  "clientName": "VC Issuer & Verifier",
  "purpose": "Issue and verify credentials",
  "showInfoBanner": true,
  "port": 8080,
  "credentials": [
    {
      "id": "verified-employee",
      "name": "Verified Employee",
      "description": "Proves current employment status",
      "icon": "briefcase",
      "credentialType": "VerifiedEmployee",
      "manifestUrl": "<YOUR-MANIFEST-URL>",
      "hasPhoto": true,
      "photoClaimName": "photo",
      "pinCode": {
        "enabled": false,
        "length": 4
      }
    }
  ],
  "faceCheck": {
    "defaultEnabled": false,
    "matchConfidenceThreshold": 70
  }
}
```

### 4.3 Values You Need to Provide

| Setting | Where to find it |
|---------|-----------------|
| `azTenantId` | Entra admin centre → **Overview** → Tenant ID |
| `azClientId` | App registrations → your app → **Application (client) ID** |
| `azClientSecret` | The secret created in Step 3.2 |
| `DidAuthority` | Verified ID → **Overview** → Decentralised identifier (DID) |
| `credentialType` | Must exactly match the `type` in your rules definition (e.g., `VerifiedEmployee`) |
| `manifestUrl` | Verified ID → **Credentials** → your credential → **Manifest URL** |

### 4.4 Claim Name Mapping

The app sends these claims during issuance. Your **rules definition** `inputClaim` must match these names:

| Claim sent by app | Description | Rules `inputClaim` |
|---|---|---|
| `displayName` | User's full name | `$.displayName` |
| `firstName` | First name | `$.firstName` |
| `lastName` | Last name | `$.lastName` |
| `userPrincipalName` | Email/UPN | `$.userPrincipalName` |
| `photo` | Base64 photo (JPEG) | `$.photo` |

> **Note:** The app also sends `DisplayName`, `DiplayName`, `UserPrincipalName` (various casings) for compatibility with existing credential definitions. However, for new deployments, use the lowercase versions above to keep things consistent.

---

## Step 5: Deploy to Azure

### Option A: Deploy with Azure CLI (Recommended)

```bash
# Create a resource group (or use an existing one)
az group create --name rg-vc-app --location australiaeast

# Create an App Service plan
az appservice plan create --name plan-vc-app --resource-group rg-vc-app --sku B1 --is-linux

# Create the web app
az webapp create --resource-group rg-vc-app --plan plan-vc-app --name <your-app-name> --runtime "NODE:22-lts"

# Configure for deployment
az webapp config appsettings set --resource-group rg-vc-app --name <your-app-name> --settings SCM_DO_BUILD_DURING_DEPLOYMENT="true"

# Deploy (from the project root)
zip -r deploy.zip . -x "node_modules/*" ".git/*"
az webapp deploy --resource-group rg-vc-app --name <your-app-name> --src-path deploy.zip --type zip
```

### Option B: Deploy from VS Code

1. Install the **Azure App Service** extension
2. Right-click the project folder → **Deploy to Web App**
3. Select your subscription and create/select an App Service

### 5.1 Verify Deployment

```bash
curl https://<your-app-name>.azurewebsites.net/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### 5.2 Update Redirect URI

Ensure the redirect URI in your app registration matches your deployed URL:

```
https://<your-app-name>.azurewebsites.net/auth/callback
```

---

## Step 6: Test End-to-End

### 6.1 Test Issuance

1. Open `https://<your-app-name>.azurewebsites.net` in a browser
2. Click **Sign in with Microsoft** and authenticate with your Entra ID account
3. Click **Issue Credential** on the home page
4. Select the "Verified Employee" credential card
5. Choose a photo source:
   - **Use Entra ID photo** — fetches your profile photo from Microsoft 365
   - **Upload from file** — select a JPEG/PNG from your device
6. Click **Issue Credential**
7. Scan the QR code with Microsoft Authenticator
8. Accept the credential in Authenticator
9. The status should update to ✅ "Credential issued successfully!"

### 6.2 Test Verification

1. Click **Verify Credential** on the home page (or navigate to `/verify`)
2. Select the "Verified Employee" credential card
3. Optionally toggle **FaceCheck** on (requires the credential to have a photo)
4. Click **Verify Credential**
5. Scan the QR code with Microsoft Authenticator
6. Present the credential (and complete face scan if FaceCheck is enabled)
7. The status should update to ✅ "Credential verified successfully!"
8. All claims from the credential are displayed, including the photo

### 6.3 Test on Mobile

On a mobile device, the app shows a **"Open in Authenticator"** button instead of a QR code, which deep-links directly into Microsoft Authenticator.

---

## Configuration Reference

### Top-Level Settings

| Setting | Type | Required | Default | Description |
|---------|------|----------|---------|-------------|
| `azTenantId` | string | ✅ | — | Your Entra ID tenant ID |
| `azClientId` | string | ✅ | — | App registration client ID |
| `azClientSecret` | string | ✅ | — | App registration client secret |
| `DidAuthority` | string | ✅ | — | Your DID (e.g., `did:web:yourdomain.com`) |
| `clientName` | string | ✅ | — | Name shown in Authenticator during flows |
| `purpose` | string | No | — | Purpose text shown during verification |
| `showInfoBanner` | boolean | No | `true` | Show info banner with DID and tenant info |
| `port` | number | No | `8080` | Server port (overridden by `PORT` env var on Azure) |

### Credential Configuration

Each entry in the `credentials` array:

| Setting | Type | Required | Default | Description |
|---------|------|----------|---------|-------------|
| `id` | string | ✅ | — | Unique slug (e.g., `verified-employee`) |
| `name` | string | ✅ | — | Display name in the UI |
| `description` | string | ✅ | — | Short description |
| `icon` | string | No | `shield-check` | Icon: `shield-check`, `briefcase`, `award`, `user-check`, `file-check` |
| `credentialType` | string | ✅ | — | Exact type from your rules definition |
| `manifestUrl` | string | ✅ | — | Full manifest URL from Verified ID portal |
| `hasPhoto` | boolean | No | `false` | Whether this credential includes a photo |
| `photoClaimName` | string | No | `photo` | Name of the photo claim |
| `pinCode.enabled` | boolean | No | `false` | Require PIN during issuance |
| `pinCode.length` | number | No | `4` | PIN digit count |

### FaceCheck Configuration

```json
"faceCheck": {
  "defaultEnabled": false,
  "matchConfidenceThreshold": 70
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultEnabled` | boolean | `false` | Pre-toggle FaceCheck on the verify page |
| `matchConfidenceThreshold` | number | `70` | Confidence threshold (50–99) |

---

## Adding More Credentials

To add another credential type:

1. **Create the credential** in the Entra admin portal (Verified ID → Credentials) with its own display and rules definitions
2. **Add an entry** to the `credentials` array in `appsettings.json`:

```json
{
  "id": "safety-training",
  "name": "Safety Training Certificate",
  "description": "Proves completion of workplace safety training",
  "icon": "shield-check",
  "credentialType": "SafetyTraining",
  "manifestUrl": "https://verifiedid.did.msidentity.com/v1.0/tenants/<tenant-id>/verifiableCredentials/contracts/<contract-id>/manifest",
  "hasPhoto": false,
  "pinCode": { "enabled": true, "length": 6 }
}
```

3. **Restart** the app (or redeploy) — the new credential appears automatically on both the issuance and verification pages.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `?` prefix on claim labels in Authenticator | `outputClaim` in rules def doesn't match claim path in display def (case-sensitive) | Ensure exact casing match between rules `outputClaim` and display `vc.credentialSubject.<claimName>` |
| "You'll have to add this Verified ID first" during FaceCheck | Photo claim `type` in display def has wrong case | Must be exactly `image/jpg;base64url` (all lowercase `i`) |
| "Work or personal account" prompt in Authenticator | Linked domain not verified, or `clientName` doesn't match DID registration | Verify your linked domain is published and `clientName` in config matches your organisation |
| `AADSTS50011` redirect URI mismatch | Redirect URI in request doesn't match app registration | Ensure `https://<your-app>.azurewebsites.net/auth/callback` is registered |
| `Provided access token contains no roles` | Missing VC API permissions | Assign `VerifiableCredential.Create.All` role to the service principal (see Step 3.5) |
| Photo not appearing in credential | Photo encoding issue | This app uses standard base64 (correct). Ensure `User.Read.All` permission is granted for Graph photo fetch |
| Callback never arrives | App not publicly accessible | Ensure the app is deployed to a public URL (use ngrok for local dev) |
| 401 from VC API | Wrong token scope | Ensure the app is requesting scope `3db474b9-6a0c-4840-96ac-1fceb342124f/.default` (this is handled automatically) |

### Local Development

For local testing, you need a public URL for VC service callbacks:

```bash
# Using Azure Dev Tunnels (recommended)
devtunnel create --allow-anonymous
devtunnel port create -p 8080
devtunnel host

# Or using ngrok
ngrok http 8080
```

Update `http://localhost:8080/auth/callback` in your app registration's redirect URIs for local dev.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (vanilla HTML/CSS/JS)                               │
│  - Glassmorphism dark UI                                     │
│  - QR code + deep link (mobile)                              │
│  - Real-time status polling                                  │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼────────────────────────────────────────┐
│  Express Server (Node.js)                                    │
│                                                              │
│  Auth: MSAL Node (Entra ID OIDC sign-in)                     │
│  + Client Credentials (VC API + Graph API)                   │
│                                                              │
│  /              → Welcome page (public)                      │
│  /home          → Dashboard (authenticated)                  │
│  /issue         → Issuance page                              │
│  /verify        → Verification page                          │
│  /api/issue/*   → Issuance API                               │
│  /api/verify/*  → Verification API                           │
│  /api/callback  → VC Service callback receiver               │
│  /api/graph/*   → Graph API photo fetch                      │
│  /health        → Health check                               │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│  Microsoft Entra Verified ID Request Service API             │
│  - createIssuanceRequest (idTokenHint flow)                  │
│  - createPresentationRequest (with optional FaceCheck)       │
└──────────────────────────────────────────────────────────────┘
```

---

## Known Limitations

- **In-memory session store** — Sessions are lost on app restart. Suitable for single-instance deployments. For production, consider adding Redis or Azure Table Storage.
- **Single-tenant verification** — Verification only accepts credentials issued by your own DID. To accept credentials from other issuers, modify the `acceptedIssuers` array in `verifier.js`.
- **Photo fetch** requires the `User.Read.All` application permission with admin consent.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Resources

- [Microsoft Entra Verified ID Documentation](https://learn.microsoft.com/en-us/entra/verified-id/)
- [Verified ID Setup Guide](https://learn.microsoft.com/en-us/entra/verified-id/verifiable-credentials-configure-tenant)
- [Request Service REST API](https://learn.microsoft.com/en-us/entra/verified-id/get-started-request-api)
- [FaceCheck Documentation](https://learn.microsoft.com/en-us/entra/verified-id/using-facecheck)
- [Official Node.js Samples](https://aka.ms/vcsample)
