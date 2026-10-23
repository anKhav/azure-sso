<script setup lang="ts">
import type { SsoLink } from "~/types/api";
definePageMeta({ middleware: "auth" });
const { user, logout } = useAuth();
const api = useApi();
const { data: links } = await useAsyncData(
  "my-sso-links",
  () => api<SsoLink[]>("/api/user/sso/links"),
  { default: () => [] },
);
</script>
<template>
  <main>
    <h1>Dashboard</h1>
    <section class="card">
      <h2>Local account</h2>
      <p><strong>Email:</strong> {{ user?.email }}</p>
      <div class="actions">
        <NuxtLink v-if="user?.role === 'admin'" class="button" to="/admin/users">Manage users</NuxtLink>
        <button class="danger" @click="logout">Log out</button>
      </div>
    </section>
    <h2>Linked SAML identities</h2>
    <p v-if="!links.length" class="notice">
      No SAML identities are linked yet.
    </p>
    <div v-else class="grid">
      <article v-for="link in links" :key="link.id" class="card">
        <p>
          <strong>App ID:</strong> <span class="mono">{{ link.appId }}</span>
        </p>
        <p>
          <strong>NameID format:</strong>
          {{ link.nameIdFormat || "Not supplied" }}
        </p>
      </article>
    </div>
  </main>
</template>
