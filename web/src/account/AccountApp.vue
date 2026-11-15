<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AccountForm from './AccountForm.vue'
import MeAvatar from '@/components/MeAvatar.vue'
import { ACCOUNT_CHANNEL, CONNECT_ORIGIN, accountOwner } from './protocol'
const auth = useAuthStore()
const owner = ref('')
const root = ref<HTMLElement>()
const matched = computed(() => !!owner.value && auth.uid === owner.value)
const send = (type: string, extra = {}) => window.parent.postMessage({channel: ACCOUNT_CHANNEL, type, ...extra}, CONNECT_ORIGIN)
function receive(event: MessageEvent) {
  const uid = accountOwner(event, window.parent)
  if (uid) {
    owner.value = uid
    if (typeof event.data.dark === 'boolean') document.documentElement.classList.toggle('dark', event.data.dark)
  }
}
async function changed() {
  if (!matched.value || !auth.user) return
  // Only Connect receives a fresh identity token; passwords never leave this origin.
  send('changed', {uid: auth.uid, token: await auth.user.getIdToken(true)})
}
let observer: ResizeObserver | undefined
onMounted(() => {
  window.addEventListener('message', receive)
  send('ready')
  observer = new ResizeObserver(() => send('height', {height: root.value?.scrollHeight ?? 500}))
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => { window.removeEventListener('message', receive); observer?.disconnect() })
</script>
<template>
  <div ref="root">
    <p v-if="!owner || !auth.authReady" class="p-4 text-muted-foreground" role="status">Opening account settings…</p>
    <template v-else-if="matched">
      <header class="mb-5 flex items-center gap-4 px-4">
        <MeAvatar size="lg" />
        <h1 class="text-hero">Account</h1>
      </header>
      <AccountForm @changed="changed" @deleted="send('deleted')" />
    </template>
    <div v-else class="space-y-3 p-4">
      <p>Sign in again to open your account settings.</p>
      <button type="button" class="text-primary font-semibold" @click="send('reauth')">Sign in with ScotDance</button>
    </div>
  </div>
</template>
