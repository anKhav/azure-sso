<script setup lang="ts">
import type { SsoApp } from "~/types/api";
definePageMeta({ middleware: "admin" });
const fields = reactive({
  name: "",
  loginUrl: "",
  applicationId: "",
  azureIssuer: "",
});
const certificate = ref<File>();
const pending = ref(false);
const error = ref("");
const api = useApi();
function choose(event: Event) {
  certificate.value = (event.target as HTMLInputElement).files?.[0];
}
async function submit() {
  if (!certificate.value) {
    error.value = "Choose the Azure signing certificate";
    return;
  }
  pending.value = true;
  error.value = "";
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  body.append("certificate", certificate.value);
  try {
    const app = await api<SsoApp>("/sso/app/create", { method: "POST", body });
    await navigateTo(`/sso/${app.id}`);
  } catch (cause) {
    error.value = apiErrorMessage(cause);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <main>
    <section class="card">
      <h1>Add Microsoft Entra SAML app</h1>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <form @submit.prevent="submit">
        <label>Name<input v-model="fields.name" required /></label
        ><label
          >Azure Login URL<input
            v-model="fields.loginUrl"
            type="url"
            required /></label
        ><label
          >Application (Client) ID<input
            v-model="fields.applicationId"
            required /></label
        ><label
          >Microsoft Entra Identifier / IdP issuer<input
            v-model="fields.azureIssuer"
            type="url"
            required /></label
        ><label
          >Certificate (Raw or PEM .cer)<input
            type="file"
            accept=".cer,.pem,application/pkix-cert,application/x-x509-ca-cert"
            required
            @change="choose" /></label
        ><button :disabled="pending">
          {{ pending ? "Creating…" : "Create application" }}
        </button>
      </form>
    </section>
  </main>
</template>
