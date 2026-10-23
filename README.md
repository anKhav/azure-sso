# Azure SAML SSO Test

A full-stack diagnostic harness for **SP-initiated Microsoft Entra ID SAML 2.0**. It supports local accounts, multiple Entra Enterprise Applications, explicit linking of a verified SAML NameID, and later login through that link. It does not use OAuth or OIDC.

## Requirements and startup

- Node.js 20.19+; `.nvmrc` selects Node.js 22.18
- npm 10+
- OpenSSL for signed-SAML fixture tests

```bash
nvm use
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev:backend
# In another terminal:
npm run dev:frontend
```

The frontend is `http://localhost:3000` and backend is `http://localhost:3001`. JSON data uses serialized atomic replacement under `backend/database`; normalized IdP certificates use mode `0600` under `backend/uploads/certificates`. Both are ignored by git.

Before non-local use, replace `SESSION_SECRET` with 32+ random characters, set `COOKIE_SECURE=true`, and set exact public HTTPS values for `BACKEND_PUBLIC_URL` and `FRONTEND_URL`. `SAML_REDIRECT_PATHS` is a comma-separated exact path allowlist, defaulting to `/sso/result`.

## Microsoft Entra configuration

Real callbacks require a stable, publicly reachable HTTPS backend. A tunnel is suitable for testing, but its public origin must remain unchanged for the flow.

There is a two-stage bootstrap because the local app ID is part of the SP URLs:

1. In Entra admin center, open **Entra ID → Enterprise applications → New application → Create your own application** and create a non-gallery app.
2. Open **Single sign-on → SAML**. Copy **Login URL**, **Microsoft Entra Identifier**, and Application (Client) ID. Download **Certificate (Raw)**. If Entra requires Basic SAML Configuration first, use temporary placeholders and return after step 4.
3. Sign in locally, open **SSO apps → Add application**, and enter those values plus the Raw/PEM certificate.
4. On the new app detail screen, copy the generated values into Entra **Basic SAML Configuration**:
   - **Identifier (Entity ID)** = displayed SP Entity ID.
   - **Reply URL (ACS)** = displayed ACS URL.
   - **Sign on URL** = optional frontend `/login` URL.
   - **Relay State** = empty; the backend supplies a one-time dynamic value.
5. Assign the test user under **Users and groups** if required.
6. While signed in locally, choose **Link my account with Azure**. Then log out and enter the exact app name under **Continue with Azure**.

The Application (Client) ID is not the SP Entity ID or Entra issuer. The IdP signing certificate does not need regeneration when SP URLs change. Configure Entra to emit a persistent, immutable NameID; this application deliberately never links by email alone.

## API summary

Errors use `{ error, code, message, traceId }`; assertions, NameIDs, passwords, and sessions are never returned in errors.

| Method and path | Purpose | Authentication |
|---|---|---|
| `POST /user/register` | Create local account and session | Public |
| `POST /user/login` | Password login | Public |
| `GET /user/me` | Restore session | Cookie |
| `GET /user/:id` | Read only current user | Cookie |
| `POST /user/logout` | Clear session | Cookie + trusted Origin |
| `POST /sso/app/create` | Upload app config and X.509 cert | Cookie + trusted Origin |
| `GET /sso/app`, `GET /sso/app/:id` | Public-safe app config | Cookie |
| `POST /user/sso/register` | Start linking AuthnRequest from form body | Cookie + trusted Origin |
| `GET /user/sso/login` | Start linked login | Public |
| `GET /user/sso/links` | List current user’s links without NameIDs | Cookie |
| `POST /saml/acs/:appId` | Entra HTTP-POST callback | SAML protected |
| `GET /saml/metadata/:appId` | Per-app SP metadata | Public |

SAML starts use full browser navigation. `redirectUrl` must match `FRONTEND_URL` and an exact allowed path. Outcomes contain only `status` and a safe code; the result page calls `/user/me` before showing success.

## Security model

- Passwords use bcrypt cost 12. Signed sessions exist only in `HttpOnly`, `SameSite=Lax` cookies.
- Each AuthnRequest has random RelayState and request ID in one short-lived flow. node-saml’s cache provider reads and invalidates that same record.
- ACS requires `InResponseTo`, a trusted Response or Assertion signature, configured issuer and audience, exact destination and recipient, valid times, and NameID. Every ACS attempt is single-use.
- Registration uses the initiating user held server-side, so Entra’s cross-site POST need not include the old local cookie.
- `(appId, NameID)` and `(userId, appId)` are unique. Unknown identities never create accounts.
- Certificate bytes/paths, password hashes, assertions, NameIDs, and tokens stay out of public configuration and diagnostics.
- AuthnRequests are unsigned initially. Metadata says `AuthnRequestsSigned="false"` and contains no SP certificate; incoming Response/Assertion signatures remain mandatory.

## Verification

```bash
npm run format
npm run typecheck
npm test
npm run build
```

Tests generate ephemeral keys and signed responses, covering local auth, authorization, certificate rejection, metadata/AuthnRequest matching, RelayState, open redirects, signed linking/login, tampering, and replay. Generated keys are removed afterward. Automated fixtures do not prove tenant configuration; a real Azure sign-in is a separate manual test and is not claimed here.

## Troubleshooting

- **Reply URL/destination mismatch:** Entra Reply URL, generated ACS, `BACKEND_PUBLIC_URL`, Recipient, and Destination must match byte-for-byte.
- **Audience mismatch:** Entra Identifier must equal generated Entity ID, never Application (Client) ID.
- **Signature failed:** Upload the active Enterprise Application SAML signing certificate. Compare its SHA-256 fingerprint with the app screen. Certificate rollover currently means recreating the test app.
- **Issuer mismatch:** `azureIssuer` must exactly match **Microsoft Entra Identifier**, commonly `https://sts.windows.net/<tenant-id>/` including trailing slash.
- **Expired/replayed:** Restart from login/link. Flows default to five minutes and ACS attempts are single-use.
- **Unknown identity:** Link that Entra NameID locally first; there is no auto-provisioning or email matching.
- **Cookie missing:** Use HTTPS with `COOKIE_SECURE=true`. ACS sets the session on its redirect; the pre-existing cookie is intentionally unnecessary.
- **Callback unreachable:** Entra cannot reach localhost. Use public HTTPS and keep Entra and backend SP URLs consistent.
