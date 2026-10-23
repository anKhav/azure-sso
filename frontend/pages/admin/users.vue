<script setup lang="ts">
import type { AdminUser, SsoApp } from "~/types/api";
definePageMeta({ middleware: "admin" });
const api = useApi();
const config = useRuntimeConfig();
const email = ref("");
const password = ref("");
const pending = ref(false);
const error = ref("");
const { data: users, refresh } = await useAsyncData(
  "admin-users",
  () => api<AdminUser[]>("/api/admin/users"),
  { default: () => [] },
);
const { data: apps } = await useAsyncData(
  "admin-sso-apps",
  () => api<SsoApp[]>("/api/sso/app"),
  { default: () => [] },
);

async function createUser() {
  pending.value = true;
  error.value = "";
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: { email: email.value, password: password.value },
    });
    email.value = "";
    password.value = "";
    await refresh();
  } catch (cause) {
    error.value = apiErrorMessage(cause);
  } finally {
    pending.value = false;
  }
}
async function deleteUser(user: AdminUser) {
  if (!confirm(`Delete ${user.email}?`)) return;
  await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
  await refresh();
}
function isLinked(user: AdminUser, appId: string) {
  return user.ssoLinks.some((link) => link.appId === appId);
}
function registerSso(user: AdminUser, app: SsoApp) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${config.public.apiBase}/api/user/sso/register`;
  const values = {
    userId: user.id,
    appId: app.id,
    returnUrl: new URL("/admin/users", window.location.origin).toString(),
  };
  for (const [name, value] of Object.entries(values)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
async function unregisterSso(user: AdminUser, app: SsoApp) {
  if (!confirm(`Remove ${app.name} from ${user.email}?`)) return;
  await api("/api/user/sso/register", {
    method: "DELETE",
    body: { userId: user.id, appId: app.id },
  });
  await refresh();
}
</script>

<template>
  <main>
    <h1>User administration</h1>
    <section class="card">
      <h2>Create local user</h2>
      <p v-if="error" class="error">{{ error }}</p>
      <form @submit.prevent="createUser">
        <label>Email<input v-model="email" type="email" required /></label>
        <label
          >Password<input
            v-model="password"
            type="password"
            minlength="12"
            required
        /></label>
        <button :disabled="pending">
          {{ pending ? "Creating…" : "Create user" }}
        </button>
      </form>
    </section>
    <section v-for="user in users" :key="user.id" class="card">
      <div class="actions">
        <div>
          <h2>{{ user.email }}</h2>
          <small>{{ user.role }}</small>
        </div>
        <button
          v-if="user.role !== 'admin'"
          class="danger"
          @click="deleteUser(user)"
        >
          Delete user
        </button>
      </div>
      <h3>SSO access</h3>
      <p v-if="!apps.length">No SSO applications configured.</p>
      <div v-for="app in apps" :key="app.id" class="actions">
        <span>{{ app.name }}</span>
        <button
          v-if="isLinked(user, app.id)"
          class="danger"
          @click="unregisterSso(user, app)"
        >
          Remove SSO
        </button>
        <button v-else @click="registerSso(user, app)">Register SSO</button>
      </div>
    </section>
  </main>
</template>
