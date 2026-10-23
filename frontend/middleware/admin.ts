export default defineNuxtRouteMiddleware(async () => {
  const { user, restore } = useAuth();
  const current = user.value ?? (await restore());
  if (!current) return navigateTo("/login");
  if (current.role !== "admin") return navigateTo("/dashboard");
});
