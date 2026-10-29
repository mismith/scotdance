<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { get } from 'firebase/database'
import { Check, ChevronRight, LoaderCircle } from '@lucide/vue'
import { dataRef } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { sendToInbox } from '@/lib/admin/inbox'
import { gridFromText, parseGrid } from '@/lib/admin/importDancers'
import { isSameDay, parseDate } from '@/lib/format'
import Dialog from '@/components/Dialog.vue'
import DateTile from '@/components/DateTile.vue'
import EmptyState from '@/components/EmptyState.vue'
import LogoMark from '@/components/LogoMark.vue'
import LoginForm, { type LoginStep } from '@/components/LoginForm.vue'
import Button from '@/components/ui/Button.vue'
import { CHANNEL, isAllowedOrigin, isFromTool, readItem, type ToTool, type ToolItem } from './protocol'

// Sign in (if this browser isn't already), tap the competition, and the list
// is in its Import dancers, open in a new tab. One sheet over the tool, the
// app's own: the tool draws none of it (protocol.ts, ADR 0015).

const auth = useAuthStore()
const me = useMeStore()

const embedded = window.parent !== window
const dev = import.meta.env.DEV || import.meta.env.MODE === 'emulator'

// The tool that opened us, once it has handed over its list.
const toolOrigin = ref<string | null>(null)
const item = ref<ToolItem | null>(null)
const unreadable = ref(false)
const open = ref(false)

function tell(message: ToTool) {
  if (toolOrigin.value) window.parent.postMessage({ channel: CHANNEL, ...message }, toolOrigin.value)
}

function onMessage(e: MessageEvent) {
  // Only the window that framed us, from one of ScotDance.app's own sites, once.
  if (e.source !== window.parent || toolOrigin.value || !isAllowedOrigin(e.origin, { dev })) return
  if (!isFromTool(e.data)) return
  toolOrigin.value = e.origin
  item.value = readItem(e.data.item)
  unreadable.value = !item.value
  open.value = true
}

onMounted(() => {
  if (!embedded) return
  window.addEventListener('message', onMessage)
  // Who framed us isn't known yet, and this says nothing: ask for the list.
  window.parent.postMessage({ channel: CHANNEL, type: 'hello' }, '*')
})
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

// Showing: the tool matches the iframe's colour scheme (or the browser paints
// it opaque), shows it, and fades its own placeholder out.
watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  tell({ type: 'ready', scheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' })
})

// What's being sent, in a line: "57 dancers in 9 age groups, from Splits".
const summary = computed(() => {
  if (!item.value) return null
  const dancers = parseGrid(gridFromText(item.value.text))?.dancers ?? []
  const groups = new Set(dancers.map((d) => `${d.category}|${d.group}`)).size
  const from = `from ${item.value.source}`
  if (!dancers.length) return `${item.value.name}, ${from}`
  const n = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`
  return groups > 1
    ? `${n(dancers.length, 'dancer')} in ${n(groups, 'age group')}, ${from}`
    : `${n(dancers.length, 'dancer')}, ${from}`
})

// Signing in: the app's own form, titled by its step.
const loginStep = ref<LoginStep>('signin')

// The competitions you organise (not every one a system admin could),
// coming up first (soonest at the top), then earlier ones (latest first).
interface Option {
  id: string
  name: string
  date?: number | string
  location?: string
}
const competitions = ref<Option[] | null>(null)
watch(
  () => (me.permissionsLoaded ? me.managedCompetitionIds.join(',') : null),
  async (ids) => {
    competitions.value = null
    if (ids === null) return
    const list = await Promise.all(
      (ids ? ids.split(',') : []).map(async (id) => {
        const snap = await get(dataRef(`competitions/${id}`)).catch(() => null)
        const c = snap?.val() as Omit<Option, 'id'> | null
        return c ? { ...c, id, name: c.name || 'Untitled competition' } : null
      }),
    )
    competitions.value = list.filter((c): c is Option => !!c)
  },
  { immediate: true },
)
const startOfToday = () => new Date().setHours(0, 0, 0, 0)
const at = (c: Option) => (c.date ? parseDate(c.date).getTime() : NaN)
const upcoming = computed(() =>
  (competitions.value ?? [])
    .filter((c) => !(at(c) < startOfToday()))
    .sort((a, b) => (at(a) || Infinity) - (at(b) || Infinity)),
)
const earlier = computed(() =>
  (competitions.value ?? []).filter((c) => at(c) < startOfToday()).sort((a, b) => at(b) - at(a)),
)
const lists = computed(() =>
  [
    { label: 'Coming up', rows: upcoming.value },
    { label: 'Earlier', rows: earlier.value },
  ].filter((l) => l.rows.length),
)

type Step = 'loading' | 'signin' | 'pick' | 'none' | 'sent' | 'unreadable'
const sent = ref<{ name: string; url: string; tabOpened: boolean } | null>(null)
const step = computed<Step>(() => {
  if (unreadable.value) return 'unreadable'
  if (sent.value) return 'sent'
  if (!auth.authReady) return 'loading'
  if (!auth.isSignedIn) return 'signin'
  if (!competitions.value) return 'loading'
  return competitions.value.length ? 'pick' : 'none'
})

const title = computed(() => {
  switch (step.value) {
    case 'signin':
      if (loginStep.value === 'register') return 'Create an account'
      if (loginStep.value === 'forgot') return 'Reset your password'
      return 'Sign in to ScotDance.app'
    case 'pick':
      return 'Which competition?'
    case 'sent':
      return `Sent to ${sent.value?.name}`
    case 'unreadable':
      return 'This list didn’t come through'
    default:
      return 'Send to ScotDance.app'
  }
})

// Tap a competition: in its inbox, then its Import dancers in a new tab
// (the tap lets it open), where the usual preview checks it before saving.
const sending = ref<string | null>(null)
const sendError = ref<string | null>(null)
async function send(c: Option) {
  if (!item.value || !auth.uid || sending.value) return
  sending.value = c.id
  sendError.value = null
  try {
    const key = await sendToInbox(auth.uid, { ...item.value, competitionId: c.id })
    const url = `${location.origin}/competitions/${encodeURIComponent(c.id)}/manage/dancers/import?inbox=${encodeURIComponent(key)}`
    const tab = window.open(url, '_blank')
    if (tab) tab.opener = null
    sent.value = { name: c.name, url, tabOpened: !!tab }
    tell({ type: 'sent', competitionId: c.id, competitionName: c.name, url })
  } catch {
    sendError.value = 'That didn’t send. Check your connection and try again.'
  } finally {
    sending.value = null
  }
}

const addUrl = `${location.origin}/competitions/add`
</script>

<template>
  <Dialog
    v-if="embedded"
    :open="open"
    :morph="false"
    variant="sheet"
    size="md"
    @close="open = false"
    @closed="tell({ type: 'closed' })"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <span class="bg-primary-fill flex size-10 shrink-0 items-center justify-center rounded-full text-white" aria-hidden="true">
          <LogoMark class="size-7" />
        </span>
        <div class="min-w-0">
          <h2 class="text-title">{{ title }}</h2>
          <p v-if="summary && step !== 'sent' && step !== 'unreadable'" class="text-muted-foreground truncate text-sm">
            {{ summary }}
          </p>
        </div>
      </div>
    </template>

    <div class="p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <div v-if="step === 'loading'" class="flex justify-center py-10" role="status" aria-label="Loading">
        <LoaderCircle class="text-muted-foreground size-6 animate-spin" />
      </div>

      <LoginForm v-else-if="step === 'signin'" v-model:step="loginStep" />

      <div v-else-if="step === 'pick'" class="space-y-5">
        <section v-for="list in lists" :key="list.label" class="space-y-1.5">
          <h3 class="text-section">{{ list.label }}</h3>
          <ul class="rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]">
            <li v-for="c in list.rows" :key="c.id">
              <button
                type="button"
                class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2.5 pr-3 pl-4 text-left disabled:opacity-(--disabled-opacity)"
                :disabled="!!sending && sending !== c.id"
                :aria-busy="sending === c.id || undefined"
                @click="send(c)"
              >
                <DateTile :date="c.date" :today="isSameDay(c.date)" />
                <span class="min-w-0 flex-1">
                  <span class="line-clamp-2 text-base leading-snug font-semibold">{{ c.name }}</span>
                  <span v-if="c.location" class="text-muted-foreground block truncate text-sm">{{ c.location }}</span>
                </span>
                <LoaderCircle v-if="sending === c.id" class="text-muted-foreground size-5 shrink-0 animate-spin" />
                <ChevronRight v-else class="text-muted-foreground size-5 shrink-0" />
              </button>
            </li>
          </ul>
        </section>
        <p v-if="sendError" class="text-destructive text-callout font-medium" role="alert">{{ sendError }}</p>
        <p class="text-muted-foreground text-sm">
          It goes to its Import dancers, to check before saving. Signed in as {{ me.email }}.
          <button type="button" class="text-primary press font-semibold" @click="auth.signOut()">Not you?</button>
        </p>
      </div>

      <EmptyState
        v-else-if="step === 'none'"
        size="inline"
        scott
        title="No competitions to send to yet"
        description="Add yours to ScotDance.app, then send your dancers to it."
      >
        <Button variant="primary" :href="addUrl" target="_blank" rel="noopener">Add a competition</Button>
        <button type="button" class="text-primary press text-callout font-semibold" @click="auth.signOut()">
          Use another account
        </button>
      </EmptyState>

      <div v-else-if="step === 'sent' && sent" class="flex flex-col items-center gap-4 pt-2 text-center">
        <span class="bg-done-foreground/15 flex size-14 items-center justify-center rounded-full" aria-hidden="true">
          <Check class="text-done-foreground size-7" stroke-width="2.6" />
        </span>
        <p class="text-base">
          {{
            sent.tabOpened
              ? 'Its Import dancers is open in a new tab. Check the dancers there, then save.'
              : 'Open its Import dancers to check the dancers, then save.'
          }}
        </p>
        <div class="w-full space-y-2">
          <Button v-if="!sent.tabOpened" variant="primary" size="lg" block :href="sent.url" target="_blank" rel="noopener">
            Open Import dancers
          </Button>
          <Button :variant="sent.tabOpened ? 'primary' : 'secondary'" size="lg" block @click="open = false">Done</Button>
        </div>
      </div>

      <div v-else-if="step === 'unreadable'" class="space-y-4">
        <p class="text-base">
          Try sending it again. If it still doesn’t come through, download the file and import it in ScotDance.app.
        </p>
        <Button variant="primary" size="lg" block @click="open = false">Close</Button>
      </div>
    </div>
  </Dialog>

  <!-- Opened on its own, not from a tool. -->
  <main v-else class="flex min-h-svh items-center justify-center">
    <EmptyState
      scott
      title="Send to ScotDance.app"
      description="This opens from your organiser tools, like Splits, to send your work to a competition."
    >
      <Button variant="primary" href="/">Go to ScotDance.app</Button>
    </EmptyState>
  </main>
</template>

<style>
/* No app bars here: dialogs centre in the whole window. */
:root:root {
  --chrome-top: var(--safe-top);
  --chrome-bottom: var(--safe-bottom);
}
</style>
