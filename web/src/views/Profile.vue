<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { onValue } from 'firebase/database'
import { Bot, ChevronRight, Copy, ExternalLink, LogOut, Plus } from '@lucide/vue'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { friendlyError } from '@/lib/admin/write'
import { TOOLS, linkedTools, toolDate, unlinkTool, type Audience } from '@/lib/tools'
import { assistantAddress, connectionDate, connectionsFrom, disconnect, type Connection } from '@/lib/assistants'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import MeAvatar from '@/components/MeAvatar.vue'
import Dialog from '@/components/Dialog.vue'
import AssistantChanges from '@/components/AssistantChanges.vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import { ROLES, useRoles } from '@/composables/useRoles'

const auth = useAuthStore()
const me = useMeStore()
const router = useRouter()
const roles = useRoles()
const rolesLabel = computed(() => ROLES.filter((r) => roles.has(r.id)).map((r) => r.label).join(', ') || 'Not answered yet')


// The ScotDance tools they sign in to with this account (ADR 0017)
const toolLinks = ref<unknown>(null)
let offTools: (() => void) | null = null
watch(
  () => auth.uid,
  (uid) => {
    offTools?.()
    offTools = uid ? onValue(dataRef(`users:tools/${uid}`), (snap) => (toolLinks.value = snap.val())) : null
  },
  { immediate: true },
)
onScopeDispose(() => offTools?.())
const tools = computed(() => linkedTools(toolLinks.value))
const unlinking = ref<Audience | null>(null)
async function unlink(tool: Audience) {
  const { name } = TOOLS[tool]
  const ok = await confirm({
    title: `Unlink ${name}?`,
    message: `You’ll be signed out of ${name} on every device within the hour. Your work there stays as it is. To use it again, sign in with ScotDance.app.`,
    confirmLabel: `Unlink ${name}`,
    destructive: true,
  })
  if (!ok) return
  unlinking.value = tool
  try {
    await unlinkTool(tool)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    unlinking.value = null
  }
}

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
        <a href="https://connect.scotdance.app/?section=account" class="text-primary text-callout font-semibold">Edit your ScotDance account →</a>
      </section>
      <ul class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
        <li>
          <button type="button" class="press-row focus-inset flex min-h-14 w-full items-center gap-3 py-2 pr-3 pl-4 text-left" @click="roles.open()">
            <span class="min-w-0 flex-1">
              <span class="block text-base font-medium">How you use ScotDance.app</span>
              <span class="text-muted-foreground block truncate text-sm">{{ rolesLabel }}</span>
            </span>
            <ChevronRight class="text-muted-foreground/70 size-5 shrink-0" />
          </button>
        </li>
      </ul>

      <section v-if="tools.length" class="space-y-1">
        <h2 class="text-heading">Tools</h2>
        <p class="text-muted-foreground text-sm">Other ScotDance tools you sign in to with this account.</p>
        <ul class="rows-engraved -mx-4 [--inset:4.25rem] [--inset-end:1rem]">
          <li v-for="{ tool, link } in tools" :key="tool" class="flex min-h-16 items-center gap-2 py-1 pr-2 pl-4">
            <a :href="`https://${TOOLS[tool].hostname}`" target="_blank" rel="noopener" class="press-row focus-inset flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl">
              <img :src="TOOLS[tool].icon" alt="" class="size-10 shrink-0 rounded-[0.625rem]" />
              <span class="min-w-0 flex-1">
                <span class="text-primary flex items-center gap-1 text-base font-semibold">
                  <span class="truncate">{{ TOOLS[tool].name }}</span><ExternalLink class="size-3.5 shrink-0" aria-label="Opens in a new tab" />
                </span>
                <span v-if="link.signedInAt" class="text-muted-foreground block truncate text-sm">Signed in {{ toolDate(link.signedInAt) }}</span>
              </span>
            </a>
            <Button variant="plain" class="text-destructive!" :busy="unlinking === tool" @click="unlink(tool)">Unlink</Button>
          </li>
        </ul>
      </section>

      <section v-if="me.canManageAny || assistants.length" class="space-y-1">
        <h2 class="text-heading">AI assistants</h2>
        <p class="text-muted-foreground text-sm">Claude, ChatGPT and other AI assistants that manage your competitions for you. Tap one to see what it changed.</p>
        <ul v-if="assistants.length" class="rows-engraved -mx-4 [--inset:4.25rem] [--inset-end:1rem]">
          <li v-for="c in assistants" :key="c.id" class="flex min-h-16 items-center gap-1 py-1 pr-2">
            <button type="button" :aria-label="`What ${c.client?.name || 'this AI assistant'} changed`" class="press-row focus-inset flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1 pr-1 pl-4 text-left" @click="showChanges(c)">
              <span class="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-[0.625rem]"><Bot class="size-5" /></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-semibold">{{ c.client?.name || 'An AI assistant' }}</span>
                <span class="text-muted-foreground block truncate text-sm">
                  Connected {{ connectionDate(c.createdAt) }}<template v-if="c.lastUsedAt && connectionDate(c.lastUsedAt) !== connectionDate(c.createdAt)"> · Last used {{ connectionDate(c.lastUsedAt) }}</template>
                </span>
              </span>
              <ChevronRight class="text-muted-foreground/70 size-5 shrink-0" />
            </button>
            <Button variant="plain" class="text-destructive!" :busy="disconnecting === c.id" @click="disconnectAssistant(c)">Disconnect</Button>
          </li>
        </ul>
        <div class="pt-1"><Button @click="connectOpen = true"><Plus /> Connect an AI assistant</Button></div>
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
