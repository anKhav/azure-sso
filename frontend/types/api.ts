export interface User {
  id: string;
  email: string;
  createdAt: string;
  role: "admin" | "user";
}
export interface AdminUser extends User { ssoLinks: SsoLink[] }
export interface SsoApp {
  id: string;
  name: string;
  loginUrl: string;
  applicationId: string;
  azureIssuer: string;
  entityId: string;
  certificateFingerprint: string;
  acsUrl: string;
  metadataUrl: string;
  createdAt: string;
}
export interface SsoLink {
  id: string;
  userId: string;
  appId: string;
  nameIdFormat?: string;
  createdAt: string;
}
export interface ApiErrorBody {
  error: true;
  code: string;
  message: string;
  traceId: string;
}
