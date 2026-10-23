export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user";
  createdAt: string;
}
export type PublicUser = Omit<UserRecord, "passwordHash">;
