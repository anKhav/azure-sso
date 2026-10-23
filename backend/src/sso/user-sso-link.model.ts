export interface UserSsoLinkRecord {
  id: string;
  userId: string;
  appId: string;
  samlNameId: string;
  nameIdFormat?: string;
  createdAt: string;
}

export interface PublicUserSsoLink {
  id: string;
  userId: string;
  appId: string;
  nameIdFormat?: string;
  createdAt: string;
}
