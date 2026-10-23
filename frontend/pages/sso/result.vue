<script setup lang="ts">
const route = useRoute();
const { user, restore } = useAuth();
const checking = ref(true);
const verified = ref(false);
onMounted(async () => {
  verified.value = Boolean(await restore());
  checking.value = false;
});
const reportedSuccess = computed(() => route.query.status === "success");
</script>
<template>
  <main>
    <section class="card">
      <h1>SAML result</h1>
      <p v-if="checking" class="notice">Verifying the local session…</p>
      <p v-else-if="reportedSuccess && verified" class="success">
        Azure SAML completed and the backend session is authenticated as
        {{ user?.email }}.
      </p>
      <p v-else class="error">
        SAML sign-in was not completed. Code:
        {{ route.query.code || "SESSION_NOT_VERIFIED" }}
      </p>
      <div class="actions">
        <NuxtLink v-if="verified" class="button" to="/dashboard"
          >Continue to dashboard</NuxtLink
        ><NuxtLink v-else class="button" to="/login">Try again</NuxtLink>
      </div>
    </section>
  </main>
</template>
