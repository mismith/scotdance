<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { onValue } from 'firebase/database'
import { Check, ChevronRight, Inbox, LoaderCircle, Trash2 } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import TextField from '@/components/admin/TextField.vue'
import { useSplit } from '@/composables/admin/useWide'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { formatLongDate, formatRelative, parseDate } from '@/lib/format'

// Competitions organisers have submitted. Approving one creates the
// competition (the server does that), gives the organiser access and
// emails them a link.

interface Submission {
  id: string
  submitted?: string
  approved?: string
  competitionId?: string
  competition?: Record<string, string | undefined>
  contact?: { name?: string; email?: string; message?: string }
}

const route = useRoute()
const split = useSplit()
const items = ref<Submission[]>([])
const loaded = ref(false)
const off = onValue(
  dataRef('competitions:submissions'),
  (snap) => {
    const val = (snap.val() ?? {}) as Record<string, Omit<Submission, 'id'>>
    items.value = Object.entries(val)
      .map(([id, s]) => ({ ...s, id }))
      .sort((a, b) => (b.submitted ?? '').localeCompare(a.submitted ?? ''))
    loaded.value = true
  },
  () => (loaded.value = true),
)
onScopeDispose(off)

const id = computed(() => (route.params.submissionId ? String(route.params.submissionId) : null))
const current = computed(() => items.value.find((s) => s.id === id.value) ?? null)
const waiting = computed(() => items.value.filter((s) => !s.approved).length)

const FIELDS: Array<{ key: string; label: string; type?: 'date'; multiline?: boolean; hint?: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'venue', label: 'Venue' },
  { key: 'address', label: 'Address' },
  { key: 'location', label: 'Town or city' },
  { key: 'sobhd', label: 'RSOBHD number' },
  { key: 'description', label: 'Description', multiline: true },
]
const pad = (n: number) => String(n).padStart(2, '0')
const dateInput = (v?: string) => {
  if (!v) return ''
  const d = parseDate(v)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const save = (s: Submission, key: string) => (v: string | null) => write({ [`competitions:submissions/${s.id}/competition/${key}`]: v })

const approving = ref(false)
async function approve(s: Submission) {
  const ok = await confirm({
    title: `Approve ${s.competition?.name ?? 'this competition'}?`,
    message: `It’s created (private until listed), and ${s.contact?.email ?? 'the organiser'} gets access and an email with a link.`,
    confirmLabel: 'Approve',
  })
  if (!ok) return
  approving.value = true
  try {
    await write({ [`competitions:submissions/${s.id}/approved`]: new Date().toISOString() })
    toast('Approved. The competition is being created.')
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    approving.value = false
  }
}
async function remove(s: Submission) {
  const ok = await confirm({ title: 'Delete this submission?', message: 'For spam or duplicates. It can’t be undone.', confirmLabel: 'Delete', destructive: true })
  if (!ok) return
  try {
    await write({ [`competitions:submissions/${s.id}`]: null })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
</script>

<template>
  <MasterDetail :show-detail="!!id">
    <template #list>
      <div class="space-y-3 p-4">
        <h1 class="text-title">Submissions <span class="text-muted-foreground text-base font-semibold">{{ waiting ? `${waiting} waiting` : '' }}</span></h1>
        <EmptyState v-if="loaded && !items.length" :icon="Inbox" title="No submissions" />
        <ul v-else class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li v-for="s in items" :key="s.id">
            <RouterLink
              :to="{ name: 'admin.submissions', params: { submissionId: s.id } }"
              :replace="split"
              :class="['flex min-h-16 items-center gap-3 px-4 py-2', id === s.id ? 'bg-blue-paper' : 'hover:bg-accent']"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-bold">{{ s.competition?.name || 'Untitled' }}</span>
                <span class="text-muted-foreground block truncate text-sm">{{ [s.contact?.name, s.submitted ? formatRelative(s.submitted) : null].filter(Boolean).join(' · ') }}</span>
              </span>
              <span v-if="s.approved" class="bg-done text-done-foreground rounded-full px-2.5 py-1 text-sm font-bold">Approved</span>
              <span v-else class="bg-next text-next-foreground rounded-full px-2.5 py-1 text-sm font-bold">Waiting</span>
              <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
            </RouterLink>
          </li>
        </ul>
      </div>
    </template>
    <template #empty>
      <div class="hidden h-full items-center justify-center p-8 md:flex"><p class="text-muted-foreground text-base">Choose a submission to review it.</p></div>
    </template>
    <template #detail>
      <div v-if="current" :key="current.id" class="mx-auto max-w-2xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))] md:p-8">
        <header class="space-y-1">
          <p class="text-muted-foreground text-sm font-bold">Submitted {{ current.submitted ? formatRelative(current.submitted) : '' }}</p>
          <h2 class="text-display">{{ current.competition?.name || 'Untitled' }}</h2>
          <p v-if="current.competition?.date" class="text-muted-foreground text-base">{{ formatLongDate(current.competition.date) }}</p>
        </header>

        <section v-if="current.approved" class="bg-done text-done-foreground flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <Check class="size-5 shrink-0" />
          <p class="min-w-0 flex-1 font-semibold">Approved {{ formatRelative(current.approved) }}.</p>
          <RouterLink v-if="current.competitionId" :to="{ name: 'manage', params: { competitionId: current.competitionId } }" class="bg-card text-foreground h-10 content-center rounded-xl px-3 text-sm font-bold">Manage it</RouterLink>
          <span v-else class="flex items-center gap-1.5 text-sm font-semibold"><LoaderCircle class="size-4 animate-spin" /> Creating…</span>
        </section>

        <section class="space-y-4">
          <h3 class="text-heading">Competition</h3>
          <p v-if="!current.approved" class="text-muted-foreground text-sm">Tidy anything up before approving. Changes here are copied into the competition.</p>
          <TextField
            v-for="f in FIELDS"
            :key="f.key"
            :model-value="f.type === 'date' ? dateInput(current.competition?.[f.key]) : current.competition?.[f.key]"
            :label="f.label"
            :type="f.type ?? 'text'"
            :multiline="f.multiline"
            :disabled="!!current.approved"
            :save="save(current, f.key)"
          />
        </section>

        <section class="bg-card space-y-1 rounded-2xl border p-4">
          <h3 class="text-heading">From</h3>
          <p class="text-base font-semibold">{{ current.contact?.name ?? 'Unknown' }}</p>
          <p v-if="current.contact?.email" class="text-base"><a :href="`mailto:${current.contact.email}`" class="text-primary font-semibold">{{ current.contact.email }}</a></p>
          <p v-if="current.contact?.message" class="text-muted-foreground pt-2 text-base whitespace-pre-line">{{ current.contact.message }}</p>
        </section>

        <footer class="flex flex-wrap gap-2 border-t pt-6">
          <button v-if="!current.approved" type="button" :disabled="!canEdit || approving" class="bg-primary text-primary-foreground flex h-12 items-center gap-2 rounded-xl px-6 text-base font-bold disabled:opacity-50" @click="approve(current)">
            <Check class="size-5" /> Approve
          </button>
          <button type="button" :disabled="!canEdit" class="text-destructive hover:bg-destructive/10 flex h-12 items-center gap-2 rounded-xl px-4 font-bold disabled:opacity-50" @click="remove(current)">
            <Trash2 class="size-4" /> Delete
          </button>
        </footer>
      </div>
      <EmptyState v-else :icon="Inbox" title="This submission isn’t here any more" />
    </template>
  </MasterDetail>
</template>
