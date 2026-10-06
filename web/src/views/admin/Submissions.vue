<script setup lang="ts">
import { computed, onBeforeUnmount, onScopeDispose, reactive, ref, watch, watchEffect } from 'vue'
import { useElementSize, useEventListener, useIntervalFn } from '@vueuse/core'
import { RouterLink, useRoute } from 'vue-router'
import { onValue } from 'firebase/database'
import { Ban, Check, ChevronDown, ChevronRight, CircleAlert, Copy, Inbox, LoaderCircle, Mail, RotateCw, Trash2 } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import EmptyState from '@/components/EmptyState.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import MovingList from '@/components/admin/MovingList.vue'
import ApproveSheet from '@/components/admin/ApproveSheet.vue'
import RejectSheet from '@/components/admin/RejectSheet.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import TextField from '@/components/admin/TextField.vue'
import VenueField from '@/components/admin/VenueField.vue'
import { useSplit } from '@/composables/admin/useWide'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { emails, reasonLabel, replyStatus, type RejectReason, type Rejection } from '@/lib/admin/submissions'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { formatLongDate, formatRelative, parseDate } from '@/lib/format'
import { placesAvailable, type VenueFields } from '@/lib/maps'
import { grow, shrink } from '@/lib/admin/motion'
import { useMorph } from '@/lib/morph'
import OrganisationMark from '@/components/OrganisationMark.vue'
import { useOrganisations } from '@/composables/useOrganisations'
import { useAuthStore } from '@/stores/auth'

// Competitions organisers have submitted. Approving one creates the
// competition (the server does that), gives the organiser access and
// emails them a link. Rejecting one keeps it, folded away with a reason and,
// if you write one, a reply the server emails them (see RejectSheet). Those
// waiting come first; rejected and approved ones fold away. Approve and
// Reject sit in a bar at the foot of the page (⌘Enter approves). Select picks
// several, as in the Manage collections: approve or reject waiting ones
// together, or delete rejected ones.

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
  /** When it was rejected (cleared if it's approved after all). */
  rejected?: string
  rejectedBy?: string
  rejection?: Rejection
  /** The server's word on the reply's email: sent, or not. */
  replied?: string
  replyFailed?: string
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

const status = (s: Submission) => (s.approved ? 'approved' : s.rejected ? 'rejected' : 'waiting')
const waiting = computed(() => items.value.filter((s) => status(s) === 'waiting'))
// Waiting first, then the decided ones, folded away: rejected (the latest
// first), then approved. Waiting and rejected ones can be selected.
const groups = computed(() => [
  { key: 'waiting' as const, title: 'Waiting', icon: Inbox, items: waiting.value, foldable: false, selectable: true },
  {
    key: 'rejected' as const,
    title: 'Rejected',
    icon: Ban,
    items: items.value.filter((s) => status(s) === 'rejected').sort((a, b) => (b.rejected ?? '').localeCompare(a.rejected ?? '')),
    foldable: true,
    selectable: true,
  },
  { key: 'approved' as const, title: 'Approved', icon: Check, items: items.value.filter((s) => status(s) === 'approved'), foldable: true, selectable: false },
])
type Group = (typeof groups.value)[number]
// Folded until asked for, or until one of them is open.
const unfolded = reactive({ rejected: false, approved: false })
const isOpen = (g: Group) => g.key === 'waiting' || unfolded[g.key]
watch(current, (s) => {
  const st = s && status(s)
  if (st && st !== 'waiting') unfolded[st] = true
})
// Each group's heading (Waiting, Rejected, Approved) sticks under the list's
// own title, however tall that is, until the next group's pushes it on.
const head = ref<HTMLElement | null>(null)
const { height: headHeight } = useElementSize(head, undefined, { box: 'border-box' })
const groupHead = 'bg-muted sticky top-[calc(var(--chrome-top)+var(--list-head))] z-5 flex items-center md:top-(--list-head)'

// Selecting several. What's picked counts only while it still applies (an
// approved one drops out, say, if someone else approves it meanwhile).
const selecting = ref(false)
const selected = reactive(new Set<string>())
function toggleSelecting() {
  selecting.value = !selecting.value
  selected.clear()
}
function toggle(sid: string) {
  if (selected.has(sid)) selected.delete(sid)
  else selected.add(sid)
}
const picked = computed(() => ({
  waiting: items.value.filter((s) => selected.has(s.id) && status(s) === 'waiting'),
  rejected: items.value.filter((s) => selected.has(s.id) && status(s) === 'rejected'),
}))
const pickedCount = computed(() => picked.value.waiting.length + picked.value.rejected.length)
const showBulk = computed(() => selecting.value && pickedCount.value > 0)
const canSelect = computed(() => groups.value.some((g) => g.selectable && g.items.length))
const allPicked = (g: Group) => g.items.length > 0 && g.items.every((s) => selected.has(s.id))
function toggleGroup(g: Group) {
  if (allPicked(g)) {
    for (const s of g.items) selected.delete(s.id)
    return
  }
  for (const s of g.items) selected.add(s.id)
  if (g.key !== 'waiting') unfolded[g.key] = true
}

// The organisations it asked to be listed under: ones already here (is the
// submitter one of their admins, or is this a claim to check?) and new ones.
// Followed for the open one, and for any picked to approve together.
const orgs = useOrganisations()
const adminsOf = ref<Record<string, Record<string, boolean>>>({})
watch(
  () => [current.value, ...picked.value.waiting].flatMap((s) => Object.keys(s?.organisations ?? {})),
  (ids) => {
    for (const oid of new Set(ids)) {
      if (oid in adminsOf.value) continue
      adminsOf.value = { ...adminsOf.value, [oid]: {} }
      onValue(dataRef(`organisations:permissions/${oid}/users`), (snap) => (adminsOf.value = { ...adminsOf.value, [oid]: snap.val() ?? {} }), () => {})
    }
  },
  { immediate: true },
)
const theirs = (sub: Submission, oid: string) => !!sub.submittedBy && adminsOf.value[oid]?.[sub.submittedBy] === true
const orgName = (oid: string) => orgs.byId.value.get(oid)?.name ?? 'A deleted organisation'
function requested(sub: Submission) {
  return [
    ...Object.keys(sub.organisations ?? {}).map((oid) => ({
      key: oid,
      org: orgs.byId.value.get(oid) ?? { name: 'A deleted organisation' },
      note: theirs(sub, oid) ? 'They’re one of its admins' : 'Not one of its admins: check it’s theirs to claim',
    })),
    ...Object.entries(sub.newOrganisations ?? {}).map(([k, o]) => ({
      key: k,
      org: { name: o.name ?? 'Untitled', shortName: o.shortName ?? null },
      note: sub.approved ? 'Started when approved' : 'New: they’ll be its admin',
    })),
  ]
}

// How a reply went is checked against the clock (a server that never says
// either way didn't send it), so the clock ticks while one's open.
const now = ref(Date.now())
useIntervalFn(() => (now.value = Date.now()), 15_000)
const replyOf = (s: Submission) => replyStatus(s, now.value)
function rowLine(s: Submission) {
  const st = status(s)
  const when = st === 'waiting' ? (s.submitted ? formatRelative(s.submitted) : null) : st === 'rejected' ? `rejected ${formatRelative(s.rejected!)}` : `approved ${formatRelative(s.approved!)}`
  return [s.contact?.name, when].filter(Boolean).join(' · ')
}
// "Rejected today: already submitted. No one was told."
function rejectedLine(s: Submission) {
  const why = reasonLabel(s.rejection?.reason)
  const told = emails(s.rejection?.reason, s.rejection?.reply) ? '' : ' No one was told.'
  return `Rejected ${formatRelative(s.rejected!)}${why ? `: ${why.toLowerCase()}` : ''}.${told}`
}

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
const at = (s: Submission, key: string) => `competitions:submissions/${s.id}/${key}`
const save = (s: Submission, key: string) => (v: string | null) => write({ [at(s, `competition/${key}`)]: v })
// Picking the venue puts it on the map (and in "near me") once approved.
async function pickVenue(s: Submission, { venue, address, location, ...place }: VenueFields) {
  const fields = { ...(venue && { venue }), ...(address && { address }), ...(location && { location }), ...place }
  try {
    await write(Object.fromEntries(Object.entries(fields).map(([k, v]) => [at(s, `competition/${k}`), v])))
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
const onMap = (s: Submission) => Number.isFinite(s.competition?.lat) && Number.isFinite(s.competition?.lng)

// The sheets for rejecting (one, or several) and approving several, opened
// from the bars (⌘Enter is the reject sheet's own while it's open).
const rejecting = useMorph()
const approvingMany = useMorph()
// Toasts (an Undo, say) rise above the bars instead of covering their buttons.
const root = document.documentElement.style
watchEffect(() => root.setProperty('--toast-lift', showBulk.value || (current.value && !current.value.approved) ? '4.5rem' : '0px'))
onBeforeUnmount(() => root.removeProperty('--toast-lift'))

const approving = ref(false)
// (⌘Enter pressed again while it asks doesn't ask twice.)
let asking = false
async function approve(s: Submission) {
  if (asking || approving.value) return
  asking = true
  const ok = await confirm({
    title: `Approve ${s.competition?.name ?? 'this competition'}?`,
    message: `It’s created (unlisted, so only admins see it), and ${s.contact?.email ?? 'the organiser'} gets access and an email with a link.`,
    confirmLabel: 'Approve',
  }).finally(() => (asking = false))
  if (!ok) return
  approving.value = true
  try {
    // A rejected one can be approved after all (say, once they've answered a
    // question in your reply). What you replied stays with it.
    await write({ [at(s, 'approved')]: new Date().toISOString(), [at(s, 'rejected')]: null })
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
  if (!s || s.approved || !canEdit.value || rejecting.open || approvingMany.open) return
  e.preventDefault()
  void approve(s)
})

// Rejecting: the sheet asks why and what to reply, both optional. A reply is
// emailed by the server, which then says how that went (`replied`, or
// `replyFailed`); without one, no one is told, so it can be undone. Several at
// once each get the same reply, in a note of their own.
const auth = useAuthStore()
const rejectIds = ref<string[]>([])
const fromBulk = ref(false)
const rejectList = computed(() => items.value.filter((s) => rejectIds.value.includes(s.id)))
// The preview shows one of them: the first with an email address.
const rejectExample = computed(() => rejectList.value.find((s) => s.contact?.email) ?? rejectList.value[0])
function openReject(list: Submission[], e: Event, bulk = false) {
  rejectIds.value = list.map((s) => s.id)
  fromBulk.value = bulk
  void rejecting.show(e)
}
const rejectBusy = ref(false)
async function reject(list: Submission[], { reason, reply }: { reason: RejectReason | null; reply: string | null }) {
  if (rejectBusy.value || !list.length) return
  rejectBusy.value = true
  const when = new Date().toISOString()
  const updates: Record<string, unknown> = {}
  const told = list.filter((s) => emails(reason, reply) && !!s.contact?.email)
  for (const s of list) {
    const sends = told.includes(s)
    Object.assign(updates, {
      [at(s, 'rejected')]: when,
      [at(s, 'rejectedBy')]: auth.uid,
      [at(s, 'rejection')]: reason || sends ? { ...(reason && { reason }), ...(sends && { reply }) } : null,
      [at(s, 'replied')]: null,
      [at(s, 'replyFailed')]: null,
    })
  }
  try {
    await write(updates)
    void rejecting.hide()
    if (fromBulk.value) doneSelecting()
    const what = list.length === 1 ? 'Rejected' : `Rejected ${list.length}`
    if (!told.length) toast(`${what}. No one was told.`, { action: { label: 'Undo', run: () => unreject(list) } })
    else if (list.length === 1) toast(`Rejected. Your reply is on its way to ${told[0].contact?.email}.`)
    else toast(`${what}. Your reply is on its way to ${told.length === list.length ? 'each of them' : `${told.length} of them`}.`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    rejectBusy.value = false
  }
}
async function unreject(list: Submission[]) {
  try {
    await write(Object.fromEntries(list.flatMap((s) => [[at(s, 'rejected'), null], [at(s, 'rejectedBy'), null], [at(s, 'rejection'), null]])))
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
function doneSelecting() {
  selecting.value = false
  selected.clear()
}

// Approving several: the sheet lists them, flagging anything that'd usually be
// tidied or checked first, then each becomes a competition (the server's work).
const approveIds = ref<string[]>([])
const approveList = computed(() => items.value.filter((s) => approveIds.value.includes(s.id) && !s.approved))
const approveItems = computed(() =>
  approveList.value.map((s) => ({
    id: s.id,
    name: String(s.competition?.name || 'Untitled'),
    line: [s.competition?.date ? formatLongDate(s.competition.date) : null, s.contact?.email].filter(Boolean).join(' · '),
    flags: [
      ...(onMap(s) ? [] : ['Not on the map yet']),
      ...Object.keys(s.organisations ?? {})
        .filter((oid) => !theirs(s, oid))
        .map((oid) => `Lists it under ${orgName(oid)}, though they’re not one of its admins`),
    ],
  })),
)
function openApproveMany(e: Event) {
  approveIds.value = picked.value.waiting.map((s) => s.id)
  void approvingMany.show(e)
}
const approveManyBusy = ref(false)
async function approveMany() {
  const list = approveList.value
  if (approveManyBusy.value || !list.length) return
  approveManyBusy.value = true
  const when = new Date().toISOString()
  try {
    await write(Object.fromEntries(list.flatMap((s) => [[at(s, 'approved'), when], [at(s, 'rejected'), null]])))
    void approvingMany.hide()
    doneSelecting()
    toast(list.length === 1 ? 'Approved. The competition is being created.' : `Approved ${list.length}. The competitions are being created.`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    approveManyBusy.value = false
  }
}

// Deleting rejected ones, for good.
async function removeMany(list: Submission[]) {
  const n = list.length
  const ok = await confirm({
    title: n === 1 ? 'Delete this rejected submission?' : `Delete ${n} rejected submissions?`,
    message: 'This can’t be undone.',
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    await write(Object.fromEntries(list.map((s) => [`competitions:submissions/${s.id}`, null])))
    doneSelecting()
    toast(n === 1 ? 'Deleted.' : `Deleted ${n}.`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// A reply that didn't go out: the server sends it again when asked…
async function sendAgain(s: Submission) {
  try {
    await write({ [at(s, 'rejection/retried')]: new Date().toISOString(), [at(s, 'replyFailed')]: null })
    toast('Sending it again.')
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
// …or send it yourself.
async function copyReply(s: Submission) {
  try {
    await navigator.clipboard.writeText(s.rejection?.reply ?? '')
    toast(`Reply copied. Send it to ${s.contact?.email ?? 'them'} any way you like.`)
  } catch {
    toast('The reply couldn’t be copied.', { tone: 'error' })
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
  <MasterDetail :show-detail="!!id" :single="loaded && !items.length">
    <template #list>
      <!-- Each group's heading sticks under the title while its rows scroll by. -->
      <div :style="{ '--list-head': `${headHeight}px` }" :class="showBulk && 'max-md:pb-24'">
        <div ref="head" class="bg-background sticky top-(--chrome-top) z-10 border-b p-4 md:top-0">
          <SectionHeader title="Submissions" :count="waiting.length ? `${waiting.length} waiting` : null">
            <template v-if="canSelect" #actions>
              <Button variant="plain" class="-mr-3" :aria-pressed="selecting" @click="toggleSelecting">
                {{ selecting ? 'Done' : 'Select' }}
              </Button>
            </template>
            <p v-if="selecting" class="text-muted-foreground text-sm" aria-live="polite">
              {{ pickedCount ? `${pickedCount} selected` : 'Choose the ones to approve, reject or delete.' }}
            </p>
          </SectionHeader>
        </div>
        <EmptyState v-if="loaded && !items.length" :icon="Inbox" title="No submissions" description="Competitions organisers submit show here for approval." />
        <template v-else-if="loaded">
          <template v-for="g in groups" :key="g.key">
            <section v-if="g.key === 'waiting' || g.items.length" :aria-labelledby="`${g.key}-h`">
              <div :class="groupHead">
                <!-- Selecting: the whole group in one go. -->
                <Checkbox
                  v-if="selecting && g.selectable && g.items.length"
                  as="button"
                  class="ml-4"
                  :checked="allPicked(g)"
                  :aria-label="`Select every ${g.title.toLowerCase()} one`"
                  @toggle="toggleGroup(g)"
                />
                <h2 :id="`${g.key}-h`" class="min-w-0 flex-1">
                  <button
                    v-if="g.key !== 'waiting'"
                    type="button"
                    :aria-expanded="unfolded[g.key]"
                    :class="['press-row focus-inset flex min-h-12 w-full items-center gap-2 pr-4 text-left', selecting && g.selectable ? 'pl-3' : 'pl-4']"
                    @click="unfolded[g.key] = !unfolded[g.key]"
                  >
                    <component :is="g.icon" :class="['size-5 shrink-0', g.key === 'approved' ? 'text-done-foreground' : 'text-muted-foreground']" aria-hidden="true" />
                    <span class="text-callout min-w-0 flex-1 font-semibold">{{ g.title }} <span class="text-muted-foreground font-normal tabular-nums">{{ g.items.length }}</span></span>
                    <ChevronDown :class="['text-muted-foreground size-5 shrink-0 transition-transform duration-(--dur-base) ease-snappy', unfolded[g.key] && 'rotate-180']" />
                  </button>
                  <span v-else :class="['flex min-h-12 items-center gap-2 pr-4', selecting && g.items.length ? 'pl-3' : 'pl-4']">
                    <component :is="g.icon" class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
                    <span class="text-callout min-w-0 flex-1 font-semibold">{{ g.title }}</span>
                    <span v-if="g.items.length" class="bg-next text-next-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-sm font-semibold tabular-nums">{{ g.items.length }}</span>
                  </span>
                </h2>
              </div>
              <p v-if="g.key === 'waiting' && !g.items.length" class="text-muted-foreground px-4 py-6 text-base">Nothing waiting.</p>
              <Transition :css="false" @enter="grow" @leave="shrink">
                <MovingList v-if="isOpen(g)" class="divide-y">
                  <li v-for="s in g.items" :key="s.id">
                    <!-- Rows open the submission (or, while selecting, tick it). -->
                    <component
                      :is="selecting && g.selectable ? 'button' : RouterLink"
                      v-bind="
                        selecting && g.selectable
                          ? { type: 'button', role: 'checkbox', 'aria-checked': selected.has(s.id), onClick: () => toggle(s.id) }
                          : { to: { name: 'admin.submissions', params: { submissionId: s.id } }, replace: split, 'aria-current': id === s.id ? 'true' : undefined }
                      "
                      :class="[
                        'press-row focus-inset flex w-full items-center gap-3 px-4 py-2 text-left',
                        g.key === 'waiting' ? 'min-h-16' : 'min-h-14',
                        (selecting && g.selectable ? selected.has(s.id) : id === s.id) && 'bg-blue-paper',
                      ]"
                    >
                      <!-- Selecting: a tick box grows in at the leading edge. -->
                      <span
                        aria-hidden="true"
                        :class="[
                          'flex shrink-0 items-center overflow-hidden transition-[width,opacity,margin] duration-(--dur-base) ease-standard',
                          selecting && g.selectable ? 'w-[1.375rem] opacity-100' : '-mr-3 w-0 opacity-0',
                        ]"
                      >
                        <Checkbox :checked="selected.has(s.id)" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span :class="['block truncate text-base', g.key === 'waiting' && 'font-medium']">{{ s.competition?.name || 'Untitled' }}</span>
                        <span class="text-muted-foreground block truncate text-sm">{{ rowLine(s) }}</span>
                        <span v-if="g.key === 'rejected' && replyOf(s) === 'failed'" class="text-destructive block truncate text-sm font-medium">The reply didn’t go out</span>
                      </span>
                      <ChevronRight v-if="!(selecting && g.selectable)" class="text-muted-foreground size-5 shrink-0 md:hidden" />
                    </component>
                  </li>
                </MovingList>
              </Transition>
            </section>
          </template>
        </template>

        <!-- Bulk actions: up from the bottom once something's chosen -->
        <Transition
          enter-active-class="transition-[translate,opacity] duration-(--dur-slow) ease-snappy motion-reduce:transition-opacity"
          enter-from-class="translate-y-[calc(100%+1.5rem)] opacity-0 motion-reduce:translate-y-0"
          leave-active-class="transition-[translate,opacity] duration-(--dur-quick) ease-exit"
          leave-to-class="translate-y-[calc(100%+1.5rem)] opacity-0 motion-reduce:translate-y-0"
        >
          <div
            v-if="showBulk"
            class="glass fixed inset-x-3 bottom-[calc(var(--safe-bottom)+0.75rem)] z-20 flex items-center gap-2 rounded-2xl p-2.5 md:sticky md:inset-x-auto md:bottom-3 md:mx-3"
          >
            <!-- (Small capsules, so all three fit when waiting and rejected ones are picked together.) -->
            <template v-if="picked.waiting.length">
              <Button variant="tonal" size="sm" :disabled="!canEdit" @click="openApproveMany">
                <Check /> Approve {{ picked.waiting.length }}
              </Button>
              <Button variant="tonal" size="sm" :disabled="!canEdit" @click="openReject(picked.waiting, $event, true)">
                <Ban /> Reject {{ picked.waiting.length }}
              </Button>
            </template>
            <Button v-if="picked.rejected.length" variant="destructive" size="sm" class="ml-auto" :disabled="!canEdit" @click="removeMany(picked.rejected)">
              <Trash2 /> Delete {{ picked.rejected.length }}
            </Button>
          </div>
        </Transition>
      </div>
    </template>
    <template #empty>
      <div class="hidden h-full items-center justify-center md:flex">
        <EmptyState v-if="items.length" :icon="Inbox" title="Choose a submission" description="Review it here, tidy it up, then approve or reject it." />
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
        <section v-else-if="current.rejected" class="bg-muted flex items-start gap-3 rounded-2xl px-4 py-3.5">
          <Ban class="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p class="min-w-0 flex-1 font-medium">{{ rejectedLine(current) }}</p>
        </section>

        <!-- What you replied, and whether it went (kept if it's approved after all) -->
        <section v-if="current.rejection?.reply && (current.rejected || current.replied)" class="surface space-y-3 rounded-2xl p-4" aria-labelledby="reply-h">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 id="reply-h" class="text-heading min-w-0 flex-1">Your reply</h3>
            <span v-if="replyOf(current) === 'sending'" class="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
              <LoaderCircle class="size-4 animate-spin" aria-hidden="true" /> Sending…
            </span>
            <span v-else-if="replyOf(current) === 'sent'" class="bg-done text-done-foreground inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-sm font-semibold">
              <Mail class="size-4" aria-hidden="true" /> Emailed {{ formatRelative(current.replied!) }}
            </span>
          </div>
          <p class="bg-muted rounded-xl px-3 py-2.5 text-base whitespace-pre-line">{{ current.rejection.reply }}</p>
          <template v-if="replyOf(current) === 'failed'">
            <p class="text-destructive flex items-start gap-1.5 text-sm font-medium" role="alert">
              <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              The email didn’t go out. Send it again, or copy it and send it yourself.
            </p>
            <div class="flex flex-wrap gap-2">
              <Button variant="tonal" :disabled="!canEdit" @click="sendAgain(current)"><RotateCw /> Send again</Button>
              <Button @click="copyReply(current)"><Copy /> Copy reply</Button>
            </div>
          </template>
          <p v-else class="text-muted-foreground text-sm">To {{ current.contact?.email }}. Answers come to admin@scotdance.app.</p>
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

        <!-- Waiting (or rejected): the decision stays in reach at the foot of the page. -->
        <footer
          v-if="!current.approved"
          class="glass sticky bottom-[calc(var(--safe-bottom)+0.75rem)] z-10 flex items-center gap-2 rounded-2xl p-2"
        >
          <Button variant="primary" size="lg" class="max-md:flex-1" :disabled="!canEdit" :busy="approving" :aria-keyshortcuts="isMac ? 'Meta+Enter' : 'Control+Enter'" @click="approve(current)">
            <Check /> Approve
            <kbd class="ml-1 font-sans text-sm font-normal opacity-75 max-md:hidden" aria-hidden="true">{{ approveKey }}</kbd>
          </Button>
          <Button v-if="!current.rejected" variant="tonal" size="lg" class="max-md:flex-1" :disabled="!canEdit" @click="openReject([current], $event)">
            <Ban /> Reject
          </Button>
          <Button v-else variant="plain" size="lg" class="text-destructive! ml-auto" :disabled="!canEdit" @click="remove(current)">
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

  <RejectSheet
    :morph="rejecting"
    :competition="rejectExample?.competition"
    :contact="rejectExample?.contact"
    :count="rejectList.length"
    :without-email="rejectList.filter((s) => !s.contact?.email).length"
    :busy="rejectBusy"
    @reject="reject(rejectList, $event)"
  />
  <ApproveSheet :morph="approvingMany" :items="approveItems" :busy="approveManyBusy" @approve="approveMany" />
</template>
