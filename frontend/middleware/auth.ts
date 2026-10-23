export default defineNuxtRouteMiddleware(async () => {
  const { user, restore } = useAuth();
  if (!user.value && !(await restore())) return navigateTo("/login");
});
