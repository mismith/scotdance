<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import AccountForm from '@/account/AccountForm.vue'
import AccountDefaults from './AccountDefaults.vue'
import Button from '@/components/ui/Button.vue'
import { createFirebaseSettings } from '@/account/firebase-settings'
import { useConnectAccount } from './account'
const store = useConnectAccount()
store.pageReady = false
const ready = ref(false)
const error = ref('')
const controller = createFirebaseSettings({
  uid: store.account!.uid,
  acquireToken: store.identityToken,
  refreshSession: store.refresh,
})
const settings = controller.settings
function syncAccount() {
  if (!store.account) return
  store.account.name = settings.displayName ?? ''
  store.account.email = settings.user?.email ?? ''
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
onBeforeUnmount(controller.dispose)
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
    </AccountForm>
    <div v-else-if="error" class="space-y-3">
      <p role="alert" class="text-destructive">{{ error }}</p>
      <Button @click="load">Try again</Button>
    </div>
  </section>
</template>
