<script setup lang="ts">
// Emulator-only entry for the existing primary-identity regression suite.
// Not included in either production build.
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import AccountForm from './AccountForm.vue'
const auth = useAuthStore()
const me = useMeStore()
const settings = {
  get user() {
    return auth.user ?? null
  },
  get displayName() {
    return me.displayName
  },
  get photoURL() {
    return me.photoURL
  },
  get hasPassword() {
    return auth.hasPassword
  },
  updateDisplayName: auth.updateDisplayName,
  updateUserEmail: auth.updateUserEmail,
  updateUserPassword: auth.updateUserPassword,
  resetPassword: auth.resetPassword,
  deleteAccount: auth.deleteAccount,
}
</script>
<template>
  <main v-if="auth.authReady && auth.user" class="mx-auto max-w-3xl p-4">
    <AccountForm :account="settings" class="-mx-4" />
  </main>
</template>
