<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { RouterLink, useRoute } from 'vue-router'
import { onValue } from 'firebase/database'
import { Check, ChevronDown, ChevronRight, Inbox, LoaderCircle, Trash2 } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import MovingList from '@/components/admin/MovingList.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import TextField from '@/components/admin/TextField.vue'
import VenueField from '@/components/admin/VenueField.vue'
import { useSplit } from '@/composables/admin/useWide'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { formatLongDate, formatRelative, parseDate } from '@/lib/format'
import { placesAvailable, type VenueFields } from '@/lib/maps'
import { grow, shrink } from '@/lib/admin/motion'
import OrganisationMark from '@/components/OrganisationMark.vue'
import { useOrganisations } from '@/composables/useOrganisations'

// Competitions organisers have submitted. Approving one creates the
// competition (the server does that), gives the organiser access and
// emails them a link. Those waiting come first; approved ones fold away.
// Approve sits in a bar at the foot of the page (⌘Enter too).

interface Submission {
  id: string
  submitted?: string
  approved?: string
  competitionId?: string
  competition?: Record<string, string | number | undefined>
  contact?: { name?: string; email?: string; message?: string }
  submittedBy?: string
  /** Picked in Submit: ones already here. */
  organisations?: Record<string, boolean>
  /** New ones, made at approval with the submitter as their admin. */
  newOrganisations?: Record<string, { name?: string; shortName?: string | null }>
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

// The organisations it asked to be listed under: ones already here (is the
// submitter one of their admins, or is this a claim to check?) and new ones.
const orgs = useOrganisations()
const adminsOf = ref<Record<string, Record<string, boolean>>>({})
watch(
  () => Object.keys(current.value?.organisations ?? {}),
  (ids) => {
    for (const oid of ids) {
      if (oid in adminsOf.value) continue
      onValue(dataRef(`organisations:permissions/${oid}/users`), (snap) => (adminsOf.value = { ...adminsOf.value, [oid]: snap.val() ?? {} }), () => {})
    }
  },
  { immediate: true },
)
function requested(sub: Submission) {
  const theirs = (oid: string) => !!sub.submittedBy && adminsOf.value[oid]?.[sub.submittedBy] === true
  return [
    ...Object.keys(sub.organisations ?? {}).map((oid) => ({
      key: oid,
      org: orgs.byId.value.get(oid) ?? { name: 'A deleted organisation' },
      note: theirs(oid) ? 'They’re one of its admins' : 'Not one of its admins: check it’s theirs to claim',
    })),
    ...Object.entries(sub.newOrganisations ?? {}).map(([k, o]) => ({
      key: k,
      org: { name: o.name ?? 'Untitled', shortName: o.shortName ?? null },
      note: sub.approved ? 'Started when approved' : 'New: they’ll be its admin',
    })),
  ]
}
const waiting = computed(() => items.value.filter((s) => !s.approved))
const approved = computed(() => items.value.filter((s) => s.approved))
// Folded until asked for, or until one of them is open.
const showApproved = ref(false)
watch(current, (s) => {
  if (s?.approved) showApproved.value = true
})

const FIELDS: Array<{ key: string; label: string; type?: 'date'; multiline?: boolean; hint?: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'venue', label: 'Venue' },
  { key: 'address', label: 'Address' },
  { key: 'location', label: 'Town or city' },
  { key: 'sobhd', label: 'Registration number' },
  { key: 'description', label: 'Description', multiline: true },
]
const pad = (n: number) => String(n).padStart(2, '0')
const dateInput = (v?: string | number) => {
  if (!v) return ''
  const d = parseDate(v)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const save = (s: Submission, key: string) => (v: string | null) => write({ [`competitions:submissions/${s.id}/competition/${key}`]: v })
// Picking the venue puts it on the map (and in "near me") once approved.
async function pickVenue(s: Submission, { venue, address, location, ...place }: VenueFields) {
  const fields = { ...(venue && { venue }), ...(address && { address }), ...(location && { location }), ...place }
  try {
    await write(Object.fromEntries(Object.entries(fields).map(([k, v]) => [`competitions:submissions/${s.id}/competition/${k}`, v])))
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
const onMap = (s: Submission) => Number.isFinite(s.competition?.lat) && Number.isFinite(s.competition?.lng)

const approving = ref(false)
// (⌘Enter pressed again while it asks doesn't ask twice.)
let asking = false
async function approve(s: Submission) {
  if (asking || approving.value) return
  asking = true
  const ok = await confirm({
    title: `Approve ${s.competition?.name ?? 'this competition'}?`,
    message: `It’s created (private until listed), and ${s.contact?.email ?? 'the organiser'} gets access and an email with a link.`,
    confirmLabel: 'Approve',
  }).finally(() => (asking = false))
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
// ⌘Enter (Ctrl+Enter) approves the one that's open, even from a field.
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const approveKey = isMac ? '⌘↵' : 'Ctrl+↵'
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || !(isMac ? e.metaKey : e.ctrlKey) || e.isComposing) return
  const s = current.value
  if (!s || s.approved || !canEdit.value) return
  e.preventDefault()
  void approve(s)
})

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
  <MasterDetail :show-detail="!!id" :single="loaded && !items.length">
    <template #list>
      <div class="bg-background sticky top-(--chrome-top) z-10 border-b p-4 md:top-0">
        <SectionHeader title="Submissions" :count="waiting.length ? `${waiting.length} waiting` : null" />
      </div>
      <EmptyState v-if="loaded && !items.length" :icon="Inbox" title="No submissions" description="Competitions organisers submit show here for approval." />
      <template v-else-if="loaded">
        <p v-if="!waiting.length" class="text-muted-foreground px-4 py-6 text-base">Nothing waiting.</p>
        <MovingList class="divide-y">
          <li v-for="s in waiting" :key="s.id">
            <RouterLink
              :to="{ name: 'admin.submissions', params: { submissionId: s.id } }"
              :replace="split"
              :aria-current="id === s.id ? 'true' : undefined"
              :class="['press-row focus-inset flex min-h-16 items-center gap-3 px-4 py-2', id === s.id && 'bg-blue-paper']"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-medium">{{ s.competition?.name || 'Untitled' }}</span>
                <span class="text-muted-foreground block truncate text-sm">{{ [s.contact?.name, s.submitted ? formatRelative(s.submitted) : null].filter(Boolean).join(' · ') }}</span>
              </span>
              <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
            </RouterLink>
          </li>
        </MovingList>

        <!-- Approved ones: out of the way until wanted -->
        <section v-if="approved.length" class="border-t">
          <button
            type="button"
            :aria-expanded="showApproved"
            class="press-row focus-inset flex min-h-12 w-full items-center gap-2 px-4 text-left"
            @click="showApproved = !showApproved"
          >
            <span class="text-callout min-w-0 flex-1 font-semibold">Approved <span class="text-muted-foreground font-normal tabular-nums">{{ approved.length }}</span></span>
            <ChevronDown :class="['text-muted-foreground size-5 shrink-0 transition-transform duration-(--dur-base) ease-snappy', showApproved && 'rotate-180']" />
          </button>
          <Transition :css="false" @enter="grow" @leave="shrink">
            <MovingList v-if="showApproved" class="divide-y border-t">
              <li v-for="s in approved" :key="s.id">
                <RouterLink
                  :to="{ name: 'admin.submissions', params: { submissionId: s.id } }"
                  :replace="split"
                  :aria-current="id === s.id ? 'true' : undefined"
                  :class="['press-row focus-inset flex min-h-14 items-center gap-3 px-4 py-2', id === s.id && 'bg-blue-paper']"
                >
                  <Check class="text-done-foreground size-5 shrink-0" aria-hidden="true" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base">{{ s.competition?.name || 'Untitled' }}</span>
                    <span class="text-muted-foreground block truncate text-sm">{{ [s.contact?.name, `approved ${formatRelative(s.approved!)}`].filter(Boolean).join(' · ') }}</span>
                  </span>
                  <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
                </RouterLink>
              </li>
            </MovingList>
          </Transition>
        </section>
      </template>
    </template>
    <template #empty>
      <div class="hidden h-full items-center justify-center md:flex">
        <EmptyState v-if="items.length" :icon="Inbox" title="Choose a submission" description="Review it here, tidy it up and approve it." />
      </div>
    </template>
    <template #detail>
      <div v-if="current" :key="current.id" class="mx-auto max-w-2xl space-y-8 p-4 pb-[calc(1.5rem+var(--safe-bottom))] md:p-8 md:pb-6">
        <header class="space-y-1">
          <h2 class="text-display">{{ current.competition?.name || 'Untitled' }}</h2>
          <p v-if="current.competition?.date" class="text-muted-foreground text-base">{{ formatLongDate(current.competition.date) }}</p>
          <p class="text-muted-foreground text-callout">Submitted {{ current.submitted ? formatRelative(current.submitted) : '' }}</p>
        </header>

        <section v-if="current.approved" class="bg-done text-done-foreground flex flex-wrap items-center gap-3 rounded-2xl py-2 pr-2 pl-4">
          <Check class="size-5 shrink-0" />
          <p class="min-w-0 flex-1 py-1.5 font-medium">Approved {{ formatRelative(current.approved) }}.</p>
          <Button v-if="current.competitionId" :to="{ name: 'manage', params: { competitionId: current.competitionId } }">Manage it</Button>
          <span v-else class="flex items-center gap-1.5 pr-2 text-sm font-medium"><LoaderCircle class="size-4 animate-spin" /> Creating…</span>
        </section>

        <section class="space-y-4">
          <h3 class="text-heading">Competition</h3>
          <p v-if="!current.approved" class="text-muted-foreground text-sm">Tidy anything up before approving. Changes here are copied into the competition.</p>
          <template v-for="f in FIELDS" :key="f.key">
            <VenueField
              v-if="f.key === 'venue' && placesAvailable && !current.approved"
              :model-value="String(current.competition?.venue ?? '')"
              :save="save(current, 'venue')"
              @pick="pickVenue(current, $event)"
            />
            <TextField
              v-else
              :model-value="f.type === 'date' ? dateInput(current.competition?.[f.key]) : current.competition?.[f.key]"
              :label="f.label"
              :type="f.type ?? 'text'"
              :multiline="f.multiline"
              :disabled="!!current.approved"
              :save="save(current, f.key)"
            />
          </template>
          <p v-if="onMap(current)" class="text-muted-foreground text-sm">On the map.</p>
          <p v-else-if="placesAvailable && !current.approved" class="text-muted-foreground text-sm">Not on the map yet: choose the venue from the suggestions to add it.</p>
        </section>

        <section class="surface space-y-1 rounded-2xl p-4">
          <h3 class="text-heading">From</h3>
          <p class="text-base font-medium">{{ current.contact?.name ?? 'Unknown' }}</p>
          <p v-if="current.contact?.email" class="text-base"><a :href="`mailto:${current.contact.email}`" class="text-primary font-medium">{{ current.contact.email }}</a></p>
          <p v-if="current.contact?.message" class="text-muted-foreground pt-2 text-base whitespace-pre-line">{{ current.contact.message }}</p>
        </section>

        <section v-if="requested(current).length" class="space-y-2">
          <h3 class="text-heading">Organisations</h3>
          <ul class="surface divide-y overflow-hidden rounded-2xl">
            <li v-for="r in requested(current)" :key="r.key" class="flex min-h-15 items-center gap-3 px-4 py-2">
              <OrganisationMark :organisation="r.org" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-semibold">{{ r.org.name }}</span>
                <span class="text-muted-foreground block truncate text-sm">{{ r.note }}</span>
              </span>
            </li>
          </ul>
          <p v-if="!current.approved" class="text-muted-foreground text-sm">Approving lists the competition under these, and starts the new ones with the submitter as their admin.</p>
        </section>

        <!-- Waiting: the decision stays in reach at the foot of the page. -->
        <footer
          v-if="!current.approved"
          class="glass sticky bottom-[calc(var(--safe-bottom)+0.75rem)] z-10 flex items-center gap-2 rounded-2xl p-2"
        >
          <Button variant="primary" size="lg" :disabled="!canEdit" :busy="approving" :aria-keyshortcuts="isMac ? 'Meta+Enter' : 'Control+Enter'" @click="approve(current)">
            <Check /> Approve
            <kbd class="ml-1 font-sans text-sm font-normal opacity-75 max-md:hidden" aria-hidden="true">{{ approveKey }}</kbd>
          </Button>
          <Button variant="plain" size="lg" class="text-destructive! ml-auto" :disabled="!canEdit" @click="remove(current)">
            <Trash2 /> Delete
          </Button>
        </footer>
        <footer v-else class="border-t pt-6">
          <Button variant="plain" class="text-destructive! -ml-4" :disabled="!canEdit" @click="remove(current)">
            <Trash2 /> Delete
          </Button>
        </footer>
      </div>
      <EmptyState v-else :icon="Inbox" title="This submission isn’t here any more" />
    </template>
  </MasterDetail>
</template>
