# Azure SAML SSO Test Application — Implementation Plan

## 1. Goal

Build a working local full-stack test harness for Microsoft Entra ID (Azure AD) **SAML 2.0 SP-initiated SSO**, not OAuth/OIDC. Support ordinary email/password accounts, configuring multiple Azure Enterprise Applications, linking a local account to an Azure SAML identity, and signing in via an existing link. Keep the system small, observable, and suitable for debugging SAML configuration and signature failures.

## 2. Stack and repository

- Backend: NestJS, TypeScript, `@node-saml/node-saml` (or its maintained Passport integration if justified), `bcrypt`, JWT or opaque session cookie, Multer for certificate upload, class-validator.
- Frontend: Nuxt 3, TypeScript, optionally Pinia, simple accessible UI.
- Persistence: JSON files in `backend/database/`; no database server. Protect concurrent writes with serialized atomic file replacements. Do not commit real users, certificates, secrets, or sessions.
- Local ports: frontend `http://localhost:3000`, backend `http://localhost:3001`.
- Real Azure SAML testing: use a public HTTPS backend URL (e.g., tunnel or staging) for the ACS and metadata endpoints. Configure the public backend origin consistently in Azure and in generated AuthnRequests.

```text
azure-saml-test/
├── PLAN.md
├── AGENTS.md                         # optional Codex project instructions
├── backend/
│   ├── src/
│   │   ├── auth/                     # password auth, session, guards
│   │   ├── user/                     # user API
│   │   ├── sso/                      # app CRUD, registration/login orchestration
│   │   ├── saml/                     # request creation, ACS, metadata, validation
│   │   ├── storage/                  # atomic JSON repository
│   │   ├── common/                   # DTOs, filters, security helpers
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── database/
│   │   ├── users.json
│   │   ├── sso-apps.json
│   │   ├── user-sso-links.json
│   │   └── saml-flows.json
│   ├── uploads/certificates/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── pages/
│   │   ├── index.vue
│   │   ├── login.vue
│   │   ├── register.vue
│   │   ├── dashboard.vue
│   │   └── sso/
│   │       ├── index.vue
│   │       ├── create.vue
│   │       ├── [id].vue
│   │       └── result.vue
│   ├── composables/
│   ├── middleware/
│   ├── .env.example
│   └── package.json
└── README.md
```

## 3. Data models

### User (`users.json`)

```json
{
  "id": "uuid",
  "email": "test@example.com",
  "passwordHash": "bcrypt-hash",
  "createdAt": "ISO-8601"
}
```

Emails are unique case-insensitively; never return `passwordHash` to the client.

### SSO application (`sso-apps.json`)

```json
{
  "id": "uuid",
  "name": "Softimpact",
  "loginUrl": "https://login.microsoftonline.com/<tenant-id>/saml2",
  "applicationId": "azure-application-client-id",
  "azureIssuer": "https://sts.windows.net/<tenant-id>/",
  "entityId": "https://<public-backend>/saml/metadata/<app-id>",
  "certificatePath": "uploads/certificates/<app-id>.cer",
  "certificateFingerprint": "sha256-fingerprint",
  "createdAt": "ISO-8601"
}
```

`name` must be unique (case-insensitive) because login looks it up by name. `applicationId` is the Azure application/client ID and **must not** be conflated with `entityId` (our Service Provider identifier) or `azureIssuer` (Microsoft Entra IdP entity identifier). The certificate is the **Azure IdP signing public certificate**, not an SP private key. Never expose certificate bytes in GET responses.

### User SSO link (`user-sso-links.json`)

```json
{
  "id": "uuid",
  "userId": "local-user-uuid",
  "appId": "sso-app-uuid",
  "samlNameId": "stable-azure-subject",
  "nameIdFormat": "optional-format",
  "createdAt": "ISO-8601"
}
```

Uniqueness: `(appId, samlNameId)` and `(userId, appId)` for this test harness. If Azure's configured NameID is not stable, document the required claim mapping; never link by email alone.

### SAML flow (`saml-flows.json`)

Store only short-lived, single-use records containing `flowId`, `requestId`, `appId`, `operation` (`register` or `login`), `initiatingUserId` (registration only), approved `redirectUrl`, `expiresAt`, and `consumedAt`. Bind RelayState to an unguessable flow ID. Correlate `InResponseTo` with the request ID, and prevent replay. Coordinate this persistence with the SAML library's request-ID cache provider; don't maintain two independent uncorrelated caches. Expire and clean records.

## 4. REST API contract

Use a common error shape: `{ "error": true, "code": "SOME_CODE", "message": "Safe message", "traceId": "..." }`. Avoid leaking full assertions or secrets in error responses.

### User endpoints

**POST `/user/register`** (JSON)

```json
{ "email": "test@example.com", "password": "Password123!" }
```

Validate inputs, reject duplicates, hash passwords with bcrypt, return public user object. Set a local session cookie after registration (or document if registration requires subsequent login; choose one behavior consistently).

**POST `/user/login`** (JSON)

```json
{ "email": "test@example.com", "password": "Password123!" }
```

Validate credentials, establish session using `HttpOnly` cookie, return `{ "user": { "id": "...", "email": "..." } }`. Do not put a token in the URL.

**GET `/user/:id`** — authenticated, only allow reading the current user's record (unless explicit admin authorization is later added). Return public user data.

Recommended extra endpoints: **GET `/user/me`** for session restoration, **POST `/user/logout`** to clear the cookie. The requested `/user/:id` remains mandatory.

### SSO application endpoints

**POST `/sso/app/create`** — authenticated; `multipart/form-data`:

- `name` (string, required): display/login application name, e.g. `Softimpact`.
- `loginUrl` (string, required): Azure SAML Login URL.
- `applicationId` (string, required): Azure Application (Client) ID.
- `azureIssuer` (string, required): Microsoft Entra Identifier / IdP issuer.
- `certificate` (file, required): Azure `.cer` signing certificate (DER or PEM accepted).

Validate file size, type and X.509 parseability; normalize certificate to a format accepted by node-saml. Store certificate outside public web root. Return app public fields plus derived `entityId`, `acsUrl`, and `metadataUrl`. Generate app ID before deriving URLs. Use `BACKEND_PUBLIC_URL` rather than trusting the request Host header.

**GET `/sso/app`** — authenticated, list public app configurations.

**GET `/sso/app/:id`** — authenticated, get public app configuration by ID. Do not expose raw certificate or private storage paths.

### SSO registration

**GET `/user/sso/register?userId=<id>&appId=<id>&redirectUrl=<encoded-url>`**

- Require a valid local authenticated session and `userId` equal to the session's user ID. Do not trust `userId` alone.
- Validate `appId` and allowlist `redirectUrl` (e.g. exact frontend origin and allowed paths; prevent open redirects).
- Create and persist a short-lived registration flow, including the local user ID.
- Generate a real SAML AuthnRequest for this app, store its request ID, and issue a **302 browser redirect** to Azure SAML Login URL using HTTP-Redirect binding.
- After Azure POSTs to the ACS, validate SAML response and associate the verified Azure NameID with this local user. Do not overwrite an existing conflicting link; return a conflict.
- Redirect browser to approved `redirectUrl` with a non-sensitive outcome indicator such as `?status=success` or `?status=error&code=...`. Never include JWT, assertion, or NameID in query params.

### SSO login

**GET `/user/sso/login?appName=<name>&redirectUrl=<encoded-url>`**

- Resolve SSO app by unique `appName`; validate redirect URL.
- Create a short-lived login flow and real SAML AuthnRequest, then 302 redirect browser to Azure.
- On valid ACS response, look up `(appId, samlNameId)` in links. Reject unknown identities (no implicit account creation).
- Create a local authenticated session cookie and redirect to approved frontend result URL.

### SAML endpoints

**POST `/saml/acs/:appId`** — public endpoint accepting `application/x-www-form-urlencoded` fields `SAMLResponse` and `RelayState`. This is Azure's **Reply URL / Assertion Consumer Service**; it is not the frontend URL. Parse form body, locate flow, validate it against app and request, validate signature and assertion, consume flow once, then finish register/login. Ensure body size limits and safe error handling.

**GET `/saml/metadata/:appId`** — public SP metadata XML for each app, with the exact SP entity ID and ACS URL. If request signing is not enabled, don't advertise an SP signing certificate or claim AuthnRequests are signed. Metadata generation must match actual runtime configuration.

## 5. SAML security and library integration

Use `@node-saml/node-saml` with a **per-application** configuration. Key fields conceptually:

```ts
{
  entryPoint: app.loginUrl,
  issuer: app.entityId,
  callbackUrl: `${BACKEND_PUBLIC_URL}/saml/acs/${app.id}`,
  idpCert: normalizedAzureCertificate,
  audience: app.entityId,
  validateInResponseTo: 'always',
  signatureAlgorithm: 'sha256',
  digestAlgorithm: 'sha256'
}
```

Verify exact API signatures/options against the installed package version before coding. In particular, implement a suitable request-ID cache provider with expiration, and ensure SAML library behavior and the custom flow store remain synchronized.

Required checks:

1. Cryptographically verify the SAML Response or Assertion signature with the configured Azure public signing certificate according to the library's supported validation rules; reject unsigned/untrusted responses.
2. Verify the expected IdP issuer, SP audience, destination/recipient ACS URL, response status, temporal conditions, and `InResponseTo` request ID.
3. Ensure request ID and RelayState refer to the **same app and flow**, and that the flow has not expired or been consumed.
4. Extract a stable NameID (and optionally NameID format); do not identify users solely by unverified email.
5. Reject replayed responses and duplicate linking attempts.
6. Store only sanitized SAML diagnostic logs: trace ID, app ID, request ID, issuer, expected/observed audience, cert fingerprint, validation stage. Never log credentials, complete assertions, or session tokens.
7. Enforce HTTPS for real deployments, secure cookie flags, CSRF protection on session-authenticated mutations, and correct CORS credentials configuration if browser API calls cross origins.

**Important cookie consideration:** Azure sends a cross-site POST to ACS. Do not depend on a `SameSite=Lax` user session cookie being included in that POST. Associate the ACS response with the initiating session through a protected, one-time server-side flow. The final redirect can establish/refresh the backend session cookie. Configure `Secure` and `SameSite` based on the actual HTTPS deployment and frontend/backend site relationship.

No need to regenerate Azure's IdP signing certificate after changing the SP Entity ID or ACS URL. For the initial test harness, unsigned AuthnRequests are acceptable if Azure configuration permits; SP request signing can be added later with a **separate SP private key and certificate**.

## 6. Nuxt frontend

Implement simple responsive pages:

| Page | Function |
|---|---|
| `/register` | Email/password registration |
| `/login` | Regular login plus app-name-based "Login with Azure" |
| `/dashboard` | Show current authenticated user and SSO links, logout |
| `/sso` | List configured Azure SSO apps |
| `/sso/create` | Create app with name, Login URL, Client ID, IdP issuer, `.cer` upload |
| `/sso/[id]` | Show app config, SP Entity ID, ACS URL, metadata URL, link current user via Azure |
| `/sso/result` | Display success/failure; call `/user/me` to verify local session |

Use Nuxt runtime config for backend API base URL. For regular JSON requests, use `$fetch`/`useFetch` with credentials as appropriate. **For SAML start endpoints, use full browser navigation** (`window.location.assign(...)`), not AJAX:

```ts
const redirectUrl = new URL('/sso/result', window.location.origin).toString();
const query = new URLSearchParams({ appName: 'Softimpact', redirectUrl });
window.location.assign(`${apiBase}/user/sso/login?${query}`);
```

Show clear status/errors without exposing tokens or assertions. Avoid claiming success based only on `status=success`; verify backend session and user information. Use authentication middleware for protected screens, while keeping `/login`, `/register`, and `/sso/result` accessible.

## 7. Microsoft Entra Enterprise Application setup

1. Open `https://entra.microsoft.com` → **Entra ID** → **Enterprise applications** → **New application** → **Create your own application**; choose a non-gallery application, e.g. `Softimpact Test`.
2. Open **Single sign-on** and select **SAML**.
3. In **Basic SAML Configuration**, set:
   - **Identifier (Entity ID)** = backend-generated `entityId`, e.g. `https://<public-backend>/saml/metadata/<app-id>`.
   - **Reply URL (ACS)** = `https://<public-backend>/saml/acs/<app-id>`.
   - **Sign on URL** = optional frontend login page, e.g. `https://<public-frontend>/login`.
   - **Relay State** = leave empty; backend sends dynamic RelayState per request.
4. From the application's SAML settings, copy **Login URL** and **Microsoft Entra Identifier**, download **Certificate (Raw)** (or an appropriate supported `.cer` format), and locate the application's **Application (Client) ID** in the app details.
5. Enter those values in Nuxt's Create SSO App form. Because the app ID is needed for the generated ACS URL, **create the backend app first**, then enter its returned Identifier/ACS URLs into Azure. It may be necessary to save the Azure SAML settings and revisit the Login URL/certificate before the form is fully configured; document this bootstrap sequence clearly.
6. Assign a test Azure user in **Users and groups** (if assignment is required). Verify the user can authenticate.
7. Start `/user/sso/register` while logged in locally; complete Azure login and verify link created. Log out and start `/user/sso/login` with the app name; verify the local session is established.

**Never assume** the Azure Application (Client) ID is the SP Entity ID. The SP Identifier must equal the NestJS SAML `issuer`; the Reply URL must equal `callbackUrl`. For reliable end-to-end Azure testing, use publicly reachable HTTPS URLs and keep them consistent across Azure and NestJS.

## 8. Test plan and acceptance criteria

### Automated tests

- User registration: success, invalid email, weak password, duplicate email.
- User login: success, wrong password, missing user, session cookie and logout.
- Authorization: `/user/:id` cannot expose another user; app creation and linking require auth.
- SSO apps: create with valid PEM/DER `.cer`, reject invalid certificate, list/get public config, reject duplicate name.
- SAML flows: AuthnRequest generation, correct Issuer/ACS, RelayState correlation, expired flow, wrong app, unknown `InResponseTo`, replay.
- SAML ACS: valid signed test fixture accepted; tampered or incorrectly signed response rejected; wrong issuer, audience, destination, expiration rejected.
- Linking: successful registration link, duplicate/conflicting link rejected; login succeeds only for linked NameID.
- Redirects: approved redirect succeeds; malicious external redirect blocked; no token in URL.

Use generated local test certificates and deterministic SAML fixtures for automated validation; **real Azure sign-in remains a manual integration test**. Do not mock the real SAML implementation itself.

### Manual Azure scenarios

- Regular account registration/login.
- Create SSO app and configure matching Azure Identifier and ACS.
- Register/link an assigned Azure test identity.
- Log out, log in with app name, confirm `/user/me` returns expected user.
- Use a different/unknown Azure user and confirm rejection.
- Change the uploaded certificate to a mismatched one; confirm signature validation fails safely.
- Misconfigure Identifier or Reply URL; confirm useful diagnostics without bypassing validation.
- Confirm Azure SAML POST reaches ACS and backend sets a session through its redirect response.

## 9. Implementation milestones

1. Scaffold backend and frontend, add `.env.example`, README, and gitignore rules.
2. Implement JSON repositories with atomic writes, DTO validation, password authentication, cookies, and `/user/me`.
3. Implement SSO app create/list/get, certificate parsing, and metadata/ACS URL generation.
4. Implement SAML request creation, request-ID persistence, ACS response validation, and safe diagnostics.
5. Implement account linking (`/user/sso/register`) and SSO login (`/user/sso/login`).
6. Build Nuxt pages and integrate regular authentication and browser-based SAML redirects.
7. Write automated tests; document Azure configuration and test the full flow against an assigned Entra test user.

## 10. Definition of done

- All requested endpoints implemented with documented request/response contracts.
- Real Azure SAML 2.0 authentication works end to end with a configured Enterprise Application.
- User linking and SSO login both work; unknown or conflicting identities fail safely.
- SAML signatures and protocol constraints are validated; replay and open redirects are blocked.
- Nuxt can create SSO apps, start browser login, and show authenticated user/result.
- JSON persistence survives backend restarts; no SQL or external database required.
- `.env.example`, startup instructions, Azure setup instructions, troubleshooting guide, and automated tests are included.

## 11. Codex implementation instructions

Read this plan before editing code. First produce a short task breakdown and identify any library-specific API uncertainties. Implement one milestone at a time, run formatting, type checks and tests, and fix errors before continuing. Preserve the exact requested endpoint paths. Make reasonable implementation choices for unspecified details, document them in README, and do not replace SAML with OAuth/OIDC. Never claim a real Azure sign-in succeeded without actually completing a live test against a configured tenant.
