# Backend SSO Flow

## Authentication

No Bearer token is used. Authentication uses an HTTP-only session cookie:

```text
azure_saml_session=<signed JWT>
```

Cookie attributes:

```text
HttpOnly; Secure; SameSite=Lax; Max-Age=28800
```

Admin mutations require a valid session cookie, the `admin` role, and a trusted `Origin` header.

## 1. Register an SSO application

```http
POST /sso/app/create
Content-Type: multipart/form-data
Cookie: azure_saml_session=...
Origin: https://your-host
```

Payload:

| Field | Description |
|---|---|
| `name` | Local display name for the SSO application. It is also supplied as `appName` when starting SSO login. |
| `loginUrl` | Azure **Login URL**, found under **Enterprise application → Single sign-on → SAML → Set up application**. |
| `applicationId` | Azure **Application (client) ID**, found on the application Overview page. |
| `azureIssuer` | Azure **Microsoft Entra Identifier**, usually `https://sts.windows.net/{tenantId}/`. This is not the local metadata URL. |
| `certificate` | Azure **Certificate (Raw)** or PEM X.509 SAML signing certificate downloaded from **SAML Certificates**. |

Response:

```http
201 Created
```

```json
{
  "id": "uuid",
  "name": "Test",
  "entityId": "https://your-host/saml/metadata/{id}",
  "acsUrl": "https://your-host/saml/acs/{id}",
  "metadataUrl": "https://your-host/saml/metadata/{id}"
}
```

Delete an application:

```http
DELETE /sso/app/{appId}
```

```http
200 OK
```

```json
{ "success": true }
```

The application certificate and associated SSO links are deleted.

## 2. Register a user for SSO

```http
POST /user/sso/register
Content-Type: application/x-www-form-urlencoded
Cookie: azure_saml_session=...
Origin: https://your-host
```

Payload:

| Field | Description |
|---|---|
| `userId` | ID of the local user that the admin wants to link to an Azure identity. |
| `appId` | ID of the SSO application created by `POST /sso/app/create`. |
| `redirectUrl` | Approved frontend URL to receive the final success or error status. |

```json
{
  "userId": "local-user-uuid",
  "appId": "sso-app-uuid",
  "redirectUrl": "https://your-host/sso/result"
}
```

Backend actions:

1. Validate the admin session and target user.
2. Create a short-lived SAML flow with a random `RelayState`.
3. Store the admin ID and target user ID server-side.
4. Redirect the browser to Azure:

```http
303 See Other
Location: https://login.microsoftonline.com/.../saml2?SAMLRequest=...&RelayState=...
```

Azure callback:

```http
POST /saml/acs/{appId}
Content-Type: application/x-www-form-urlencoded
```

```text
SAMLResponse=<base64-response>
RelayState=<random-flow-id>
```

After validation, the backend creates this mapping:

```text
appId + Azure NameID -> local userId
```

It preserves the admin session and redirects to:

```http
303 See Other
Location: https://your-host/sso/result?status=success
```

### Unregister a user from SSO

```http
DELETE /user/sso/register
Content-Type: application/json
Cookie: azure_saml_session=...
Origin: https://your-host
```

```json
{
  "userId": "local-user-uuid",
  "appId": "sso-app-uuid"
}
```

- `userId`: local user whose SSO link will be removed.
- `appId`: SSO application from which the user will be unregistered.

```http
200 OK
```

```json
{ "success": true }
```

## 3. SSO login

```http
GET /user/sso/login?appName=Test&redirectUrl=https%3A%2F%2Fyour-host%2Fsso%2Fresult
```

- `appName`: exact local `name` used when the SSO application was created.
- `redirectUrl`: approved frontend URL to receive the login result.

No existing session is required. The backend creates a temporary SAML flow and returns:

```http
302 Found
Location: https://login.microsoftonline.com/.../saml2?SAMLRequest=...&RelayState=...
```

Azure posts the result to:

```http
POST /saml/acs/{appId}
```

The backend validates the signature, certificate, issuer, audience, destination, recipient, `InResponseTo`, expiration, and one-time `RelayState`. It resolves the local user from `appId + NameID`.

Success response:

```http
303 See Other
Set-Cookie: azure_saml_session=<signed JWT>; HttpOnly; Secure; SameSite=Lax
Location: https://your-host/sso/result?status=success
```

An unknown identity is redirected with:

```text
https://your-host/sso/result?status=error&code=SSO_IDENTITY_NOT_LINKED
```
