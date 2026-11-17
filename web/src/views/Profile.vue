<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { onValue } from 'firebase/database'
import { Bot, ChevronRight, Copy, LogOut, Plus } from '@lucide/vue'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { friendlyError } from '@/lib/admin/write'
import { assistantAddress, connectionDate, connectionsFrom, disconnect, type Connection } from '@/lib/assistants'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import MeAvatar from '@/components/MeAvatar.vue'
import Dialog from '@/components/Dialog.vue'
import AssistantChanges from '@/components/AssistantChanges.vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'

const auth = useAuthStore()
const me = useMeStore()
const router = useRouter()

// The AI assistants (Claude, ChatGPT) they've connected to manage their competitions (ADR 0018)
const connectionRecords = ref<unknown>(null)
let offConnections: (() => void) | null = null
watch(
  () => auth.uid,
  (uid) => {
    offConnections?.()
    offConnections = uid ? onValue(dataRef(`users:connections/${uid}`), (snap) => (connectionRecords.value = snap.val())) : null
  },
  { immediate: true },
)
onScopeDispose(() => offConnections?.())
const assistants = computed(() => connectionsFrom(connectionRecords.value))
function assistantLogo(connection: Connection) {
  // Client names are self-reported; identify brand marks by the OAuth client's host.
  let host = ''
  try { host = new URL(connection.client?.id || '').hostname } catch { return null }
  const onHost = (domain: string) => host === domain || host.endsWith(`.${domain}`)
  if (['claude.ai', 'claude.com', 'anthropic.com'].some(onHost)) return '/img/assistants/claude.svg'
  if (['chatgpt.com', 'openai.com'].some(onHost)) return '/img/assistants/chatgpt.svg'
  return null
}
const disconnecting = ref<string | null>(null)
async function disconnectAssistant(c: Connection) {
  const name = c.client?.name || 'this AI assistant'
  const ok = await confirm({
    title: `Disconnect ${name}?`,
    message: `It stops working with your account straight away. To use it again, connect it again.`,
    confirmLabel: `Disconnect ${name}`,
    destructive: true,
  })
  if (!ok) return
  disconnecting.value = c.id
  try {
    await disconnect(c.id)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    disconnecting.value = null
  }
}
const changesFor = ref<Connection | null>(null)
const changesOpen = ref(false)
function showChanges(c: Connection) {
  changesFor.value = c
  changesOpen.value = true
}
const connectOpen = ref(false)
const addressCopied = ref(false)
async function copyAddress() {
  try {
    await navigator.clipboard.writeText(assistantAddress())
    addressCopied.value = true
    setTimeout(() => (addressCopied.value = false), 1600)
  } catch {
    /* clipboard blocked: the address is on screen to select */
  }
}

async function handleSignOut() {
  await auth.signOut()
  router.replace({ name: 'home' })
}

</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="Account" :fallback="{ to: { name: 'settings' }, label: 'Settings' }" />

    <main class="mx-auto w-full max-w-3xl space-y-5 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header class="flex items-center gap-4">
        <MeAvatar size="lg" />
        <div class="min-w-0">
          <h1 class="text-hero truncate">{{ me.displayName || 'Your account' }}</h1>
        </div>
      </header>

      <section class="space-y-2">
        <p class="text-base">Manage your name, email, password and dancers in ScotDance Connect.</p>
        <a href="https://connect.scotdance.app/account" class="text-primary text-callout font-semibold">Edit your ScotDance account →</a>
      </section>

      <section v-if="me.canManageAny || assistants.length" class="space-y-2">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <h2 class="text-heading">AI assistants</h2>
            <p class="text-muted-foreground text-sm">Organisers can use AI assistants to manage their ScotDance competitions.</p>
          </div>
          <Button size="sm" class="shrink-0" aria-label="Connect an AI assistant" @click="connectOpen = true"><Plus /> Connect</Button>
        </div>
        <ul v-if="assistants.length" class="rows-engraved -mx-4 [--inset:4.25rem] [--inset-end:1rem]">
          <li v-for="c in assistants" :key="c.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <div class="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-[0.625rem]" :class="assistantLogo(c) ? 'bg-white' : 'bg-muted text-muted-foreground'">
                <img v-if="assistantLogo(c)" :src="assistantLogo(c)!" alt="" class="size-7" />
                <Bot v-else class="size-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-semibold">{{ c.client?.name || 'An AI assistant' }}</span>
                <span class="text-muted-foreground block text-sm">
                  Connected {{ connectionDate(c.createdAt) }}<template v-if="c.lastUsedAt && connectionDate(c.lastUsedAt) !== connectionDate(c.createdAt)"> · Last used {{ connectionDate(c.lastUsedAt) }}</template>
                </span>
              </span>
            </div>
            <div class="ml-auto flex items-center gap-1">
              <Button variant="plain" :aria-label="`Audit log for ${c.client?.name || 'this AI assistant'}`" @click="showChanges(c)">Audit log</Button>
              <Button variant="plain" class="text-destructive!" :busy="disconnecting === c.id" @click="disconnectAssistant(c)">Disconnect</Button>
            </div>
          </li>
        </ul>
      </section>

      <div class="space-y-2">
        <Button size="lg" block @click="handleSignOut"><LogOut /> Sign out</Button>

      </div>
    </main>

    <Dialog :open="connectOpen" variant="sheet" @close="connectOpen = false">
      <template #header><h2 class="text-title">Connect an AI assistant</h2></template>
      <div class="space-y-3 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
        <p class="text-base">
          In Claude or ChatGPT, add a custom connector with this address. It brings you back here to allow it.
        </p>
        <div class="field flex items-center gap-2 rounded-xl py-1 pr-1 pl-3">
          <code class="min-w-0 flex-1 text-sm break-all select-all">{{ assistantAddress() }}</code>
          <Button variant="tonal" @click="copyAddress"><Copy /> {{ addressCopied ? 'Copied' : 'Copy' }}</Button>
        </div>
        <p class="text-muted-foreground text-sm">
          It can do what you can do with the competitions and organisations you manage. It can’t invite or remove admins, or delete a competition.
        </p>
        <Button size="lg" block @click="connectOpen = false">Done</Button>
      </div>
    </Dialog>

    <AssistantChanges v-if="changesFor" :open="changesOpen" :connection="changesFor.id" :name="changesFor.client?.name || 'this AI assistant'" @close="changesOpen = false" />

  </div>
</template>
