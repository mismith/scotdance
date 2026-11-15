<script setup lang="ts">
import AccountFrame from './AccountFrame.vue'
import { useConnectAccount } from './account'
const store = useConnectAccount()
</script>
<template>
  <section>
    <h1 class="mb-5 text-hero">Account</h1>
    <div class="-mx-4">
      <AccountFrame v-if="store.account" :uid="store.account.uid" @changed="store.refresh" @reauth="store.login" @deleted="store.clear" />
    </div>
  </section>
</template>
