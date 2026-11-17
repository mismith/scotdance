<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AccountForm from '@/account/AccountForm.vue'
import AccountDefaults from './AccountDefaults.vue'
import ConnectedTools from '@/account/ConnectedTools.vue'
import Button from '@/components/ui/Button.vue'
import { useConnectSettings } from './connectSettings'
import { useConnectAccount } from './account'
const store = useConnectAccount()
store.pageReady = false
const ready = ref(false)
const error = ref('')
const controller = useConnectSettings()
const settings = controller.settings
watch(() => store.account?.emailVerified, async () => {
  if (ready.value && settings.checkEmailVerification) {
    try { await settings.checkEmailVerification() } catch { /* Next return retries. */ }
  }
})
function syncAccount() {
  if (!store.account) return
  store.account.name = settings.displayName ?? ''
  store.account.email = settings.user?.email ?? ''
  store.account.emailVerified = settings.user?.emailVerified === true
}
async function load() {
  error.value = ''
  store.pageReady = false
  try {
    await controller.load()
    ready.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not open your account.'
  } finally {
    store.pageReady = true
  }
}
onMounted(load)
</script>
<template>
  <section>
    <AccountForm
      v-if="ready"
      :account="settings"
      class="-mx-4"
      @changed="syncAccount"
      @deleted="store.clear"
    >
      <template #profile-details><AccountDefaults /></template>
      <template #details><ConnectedTools :load="controller.loadTools" :sign-out="controller.signOutTool" /></template>
    </AccountForm>
    <div v-else-if="error" class="space-y-3">
      <p role="alert" class="text-destructive">{{ error }}</p>
      <Button @click="load">Try again</Button>
    </div>
  </section>
</template>
