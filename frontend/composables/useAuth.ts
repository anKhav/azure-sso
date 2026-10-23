import type { User } from "~/types/api";

export function useAuth() {
  const user = useState<User | null>("authenticated-user", () => null);
  const api = useApi();
  async function restore(): Promise<User | null> {
    try {
      user.value = (await api<{ user: User }>("/user/me")).user;
    } catch {
      user.value = null;
    }
    return user.value;
  }
  async function logout(): Promise<void> {
    await api("/user/logout", { method: "POST" });
    user.value = null;
    await navigateTo("/login");
  }
  return { user, restore, logout };
}
