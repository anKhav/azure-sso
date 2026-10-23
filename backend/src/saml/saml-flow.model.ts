export type SamlOperation = "register" | "login";

export interface SamlFlowRecord {
  flowId: string;
  requestId: string;
  appId: string;
  operation: SamlOperation;
  initiatingUserId?: string;
  targetUserId?: string;
  redirectUrl: string;
  requestCreatedAt: string;
  expiresAt: string;
  requestValidatedAt?: string;
  consumedAt?: string;
}
