<script setup lang="ts">
import type { SsoApp } from "~/types/api";
definePageMeta({ middleware: "admin" });
const route = useRoute();
const api = useApi();
const { data: app, error } = await useAsyncData(
  `sso-app-${route.params.id}`,
  () => api<SsoApp>(`/sso/app/${route.params.id}`),
);
</script>
<template>
  <main>
    <p v-if="error" class="error">Application not found.</p>
    <template v-else-if="app"
      ><h1>{{ app.name }}</h1>
      <section class="card">
        <dl>
          <dt>Application ID</dt>
          <dd class="mono">{{ app.applicationId }}</dd>
          <dt>SP Entity ID</dt>
          <dd class="mono">{{ app.entityId }}</dd>
          <dt>ACS / Reply URL</dt>
          <dd class="mono">{{ app.acsUrl }}</dd>
          <dt>Metadata URL</dt>
          <dd>
            <a :href="app.metadataUrl" class="mono">{{ app.metadataUrl }}</a>
          </dd>
          <dt>Azure issuer</dt>
          <dd class="mono">{{ app.azureIssuer }}</dd>
          <dt>Certificate SHA-256</dt>
          <dd class="mono">{{ app.certificateFingerprint }}</dd>
        </dl>
      </section></template
    >
  </main>
</template>
