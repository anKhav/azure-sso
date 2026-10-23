<script setup lang="ts">
import type { User } from "~/types/api";
const email = ref("");
const password = ref("");
const appName = ref("");
const pending = ref(false);
const error = ref("");
const api = useApi();
const config = useRuntimeConfig();
const { user } = useAuth();
async function login() {
  pending.value = true;
  error.value = "";
  try {
    user.value = (
      await api<{ user: User }>("/api/user/login", {
        method: "POST",
        body: { email: email.value, password: password.value },
      })
    ).user;
    await navigateTo("/dashboard");
  } catch (cause) {
    error.value = apiErrorMessage(cause);
  } finally {
    pending.value = false;
  }
}
function azureLogin() {
  if (!appName.value.trim()) {
    error.value = "Enter the configured SSO application name";
    return;
  }
  const returnUrl = new URL("/dashboard", window.location.origin).toString();
  const query = new URLSearchParams({
    appName: appName.value.trim(),
    returnUrl,
  });
  window.location.assign(`${config.public.apiBase}/api/user/sso/login?${query}`);
}
</script>
<template>
  <main>
    <h1>Sign in</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="grid">
      <section class="card">
        <h2>Email and password</h2>
        <form @submit.prevent="login">
          <label
            >Email<input
              v-model="email"
              type="email"
              autocomplete="email"
              required /></label
          ><label
            >Password<input
              v-model="password"
              type="password"
              autocomplete="current-password"
              required /></label
          ><button :disabled="pending">
            {{ pending ? "Signing in…" : "Sign in" }}
          </button>
        </form>
      </section>
      <section class="card">
        <h2>Microsoft Entra SAML</h2>
        <form @submit.prevent="azureLogin">
          <label
            >SSO application name<input
              v-model="appName"
              autocomplete="organization"
              required /></label
          ><button>Continue with Azure</button>
        </form>
      </section>
    </div>
  </main>
</template>
