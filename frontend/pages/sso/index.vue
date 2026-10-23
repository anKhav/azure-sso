<script setup lang="ts">
import type { SsoApp } from "~/types/api";
definePageMeta({ middleware: "admin" });
const api = useApi();
const { data: apps, error } = await useAsyncData(
  "sso-apps",
  () => api<SsoApp[]>("/sso/app"),
  { default: () => [] },
);
const deleting = ref("");
async function deleteApp(app: SsoApp) {
  if (!confirm(`Delete ${app.name} and all its SSO links?`)) return;
  deleting.value = app.id;
  try { await api(`/sso/app/${app.id}`, { method: "DELETE" }); apps.value = apps.value.filter((item) => item.id !== app.id); }
  finally { deleting.value = ""; }
}
</script>
<template>
  <main>
    <div class="actions">
      <h1>SSO applications</h1>
      <NuxtLink class="button" to="/sso/create">Add application</NuxtLink>
    </div>
    <p v-if="error" class="error">Could not load applications.</p>
    <p v-else-if="!apps.length" class="notice">
      No Microsoft Entra applications configured.
    </p>
    <div class="grid">
      <article v-for="app in apps" :key="app.id" class="card">
        <h2>{{ app.name }}</h2>
        <p class="mono">{{ app.applicationId }}</p>
        <NuxtLink :to="`/sso/${app.id}`">View configuration</NuxtLink>
        <button class="danger" :disabled="deleting === app.id" @click="deleteApp(app)">Delete</button>
      </article>
    </div>
  </main>
</template>
