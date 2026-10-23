<script setup lang="ts">
const { user, restore } = useAuth();
onMounted(() => { if (!user.value) restore(); });
</script>
<template>
  <div>
    <header class="site-header">
      <NuxtLink class="brand" to="/">Azure SAML Test</NuxtLink>
      <nav aria-label="Main navigation">
        <NuxtLink to="/dashboard">Dashboard</NuxtLink>
        <NuxtLink v-if="user?.role === 'admin'" to="/admin/users">Users</NuxtLink>
        <NuxtLink v-if="user?.role === 'admin'" to="/sso">SSO apps</NuxtLink>
        <NuxtLink to="/login">Login</NuxtLink>
      </nav>
    </header>
    <NuxtPage />
  </div>
</template>
