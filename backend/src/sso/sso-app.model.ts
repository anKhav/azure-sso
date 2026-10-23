export interface SsoAppRecord {
  id: string;
  name: string;
  loginUrl: string;
  applicationId: string;
  azureIssuer: string;
  entityId: string;
  certificatePath: string;
  certificateFingerprint: string;
  createdAt: string;
}

export interface PublicSsoApp {
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
