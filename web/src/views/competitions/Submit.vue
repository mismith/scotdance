<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { Check, ChevronLeft, ChevronRight, Plus, Send } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Skeleton from '@/components/Skeleton.vue'
import CountryPicker from '@/components/submit/CountryPicker.vue'
import DayPicker from '@/components/submit/DayPicker.vue'
import SentMark from '@/components/submit/SentMark.vue'
import SubmitIntro from '@/components/submit/SubmitIntro.vue'
import VenueStep from '@/components/submit/VenueStep.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import OrganisationPicker from '@/components/OrganisationPicker.vue'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useOrganisations } from '@/composables/useOrganisations'
import { usePageTitle } from '@/composables/usePageTitle'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { friendlyError, newKey, write } from '@/lib/admin/write'
import { formatLongDate, parseDate } from '@/lib/format'
import { guessUserCountry } from '@/lib/locale'
import { type VenuePlace } from '@/lib/maps'
import { registrationLabel, registrations, tidyRegistration } from '@/lib/registration'
import { useMorph } from '@/lib/morph'
import {
  countryChoice,
  defaultCountry,
  nameExample,
  registrationHint,
} from '@/lib/submitCountries'
import { type OrganisationListItem } from '@/types/organisation'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Organisers ask for their competition to be added, one question at a time
// (ADR 0010): an intro, then a slide per question, each with one button at
// its foot (Continue; Skip on an optional one until it's answered), then a
// last look and Send. Once it's approved they manage it, and get an email
// saying so. Signed in only: they manage it from the same account, and the
// venue search (billed per use) isn't for passers-by.

usePageTitle(['Add a competition'])
const auth = useAuthStore()
const me = useMeStore()
const filter = useLocationFilter()

const blank = () => ({
  country: null as string | null,
  date: '',
  name: '',
  venue: '',
  address: '',
  location: '',
  sobhd: '',
  contactName: '',
  message: '',
  agree: false,
})
const form = reactive(blank())
// Where the venue search put it, when the venue was picked from it.
const place = ref<VenuePlace | null>(null)
// The country Competitions is showing (or the phone's), to start on.
const startingCountry = () =>
  defaultCountry(filter.country.value ?? guessUserCountry(), filter.region.value)

// The organisations it's run by or part of: ones already on ScotDance.app
// (any; yours first, any other is checked when it's approved), or new ones,
// made when it's approved, with you as their admin.
const orgs = useOrganisations()
const hosts = reactive({
  ids: [] as string[],
  fresh: [] as Array<{ name: string; shortName: string }>,
  offered: false,
})
const pickingOrg = useMorph()
const chosenOrgs = computed(() => [
  ...hosts.ids.flatMap((id) => {
    const org = orgs.byId.value.get(id)
    return org ? [{ key: id, org, fresh: false }] : []
  }),
  ...hosts.fresh.map((org, i) => ({
    key: `new-${i}`,
    org: { ...org, image: null, location: null },
    fresh: true,
  })),
])
// Any the name mentions ("CHDA Fall Competition": by short name or full
// name, as whole words), then yours: one tap each.
const words = (s?: string | null) =>
  ` ${(s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `
const mentioned = computed(() => {
  const name = words(form.name)
  return orgs.organisations.value.filter((o) =>
    [o.shortName, o.name].some(
      (s) => words(s).trim().length >= 3 && name.includes(words(s)),
    ),
  )
})
const suggestedOrgs = computed(() => {
  const mine = orgs.organisations.value.filter((o) =>
    me.managedOrganisationIds.includes(o.id),
  )
  return [
    ...new Map([...mentioned.value, ...mine].map((o) => [o.id, o])).values(),
  ].filter((o) => !hosts.ids.includes(o.id))
})
function addHost(org: OrganisationListItem) {
  if (!hosts.ids.includes(org.id)) hosts.ids.push(org.id)
}
function addFreshHost(org: { name: string; shortName: string }) {
  const known = orgs.organisations.value.find(
    (o) => o.name?.trim().toLowerCase() === org.name.trim().toLowerCase(),
  )
  if (known) addHost(known)
  else hosts.fresh.push(org)
}
function removeHost(key: string) {
  if (key.startsWith('new-')) hosts.fresh.splice(Number(key.slice(4)), 1)
  else hosts.ids = hosts.ids.filter((id) => id !== key)
}
// The rows on "Who's running it?": the chosen and the offered in one list
// that keeps its order, so ticking one changes it in place (focus and all)
// rather than moving it.
const orgOrder = ref<string[]>([])
const orgRows = computed(() => {
  const rows = new Map<string, { key: string; org: (typeof chosenOrgs.value)[number]['org'] | OrganisationListItem; fresh: boolean; checked: boolean }>()
  for (const h of chosenOrgs.value) rows.set(h.key, { ...h, checked: true })
  for (const o of suggestedOrgs.value) if (!rows.has(o.id)) rows.set(o.id, { key: o.id, org: o, fresh: false, checked: false })
  return rows
})
watch(
  orgRows,
  (rows) => {
    for (const key of rows.keys()) if (!orgOrder.value.includes(key)) orgOrder.value.push(key)
  },
  { immediate: true },
)
const orderedOrgRows = computed(() => orgOrder.value.flatMap((key) => orgRows.value.get(key) ?? []))
function toggleOrg(row: { key: string; org: unknown; checked: boolean }) {
  if (row.checked) removeHost(row.key)
  else addHost(row.org as OrganisationListItem)
}

// The first time there: ticked already when the name says which, or when
// you run just the one.
function offerOrgs() {
  if (hosts.offered) return
  hosts.offered = true
  if (hosts.ids.length || hosts.fresh.length) return
  const mine = orgs.organisations.value.filter((o) =>
    me.managedOrganisationIds.includes(o.id),
  )
  for (const org of mentioned.value.length
    ? mentioned.value
    : mine.length === 1
      ? mine
      : [])
    addHost(org)
}

// --- The slides

const SLIDES = [
  'country',
  'date',
  'name',
  'organisation',
  'venue',
  'registration',
  'contact',
  'review',
] as const
type Slide = (typeof SLIDES)[number]
const OPTIONAL: ReadonlySet<Slide> = new Set(['organisation', 'registration'])
const answered: Record<Slide, () => boolean> = {
  country: () => !!form.country,
  date: () => /^\d{4}-\d{2}-\d{2}$/.test(form.date),
  name: () => !!form.name.trim(),
  organisation: () => chosenOrgs.value.length > 0,
  venue: () => !!form.location.trim(),
  registration: () => !!form.sobhd.trim(),
  contact: () => !!form.contactName.trim(),
  review: () => form.agree,
}
const MISSING: Partial<Record<Slide, string>> = {
  country: 'Pick a country to continue.',
  date: 'Pick a date to continue.',
  name: 'Add its name to continue.',
  venue: 'Add the town or city to continue.',
  contact: 'Add your name to continue.',
  review: 'Tick this to send it.',
}

// Null is the intro.
const at = ref<Slide | null>(null)
const index = computed(() => (at.value ? SLIDES.indexOf(at.value) : -1))
// Changing an answer from the last look comes straight back to it.
const returning = ref(false)
const error = ref<string | null>(null)
// Which way the slides move: forward slides in from the right, back from the left.
const direction = ref<1 | -1>(1)
const heading = ref<HTMLElement | null>(null)
const venueStep = ref<InstanceType<typeof VenueStep> | null>(null)

const sending = ref(false)
const sent = ref(false)
const sendError = ref<string | null>(null)

// An answer clears what was said about it being missing.
watch([form, hosts], () => {
  if (error.value && at.value && answered[at.value]()) error.value = null
})

function go(to: Slide | null) {
  error.value = null
  sendError.value = null
  const from = index.value
  const dest = to ? SLIDES.indexOf(to) : -1
  direction.value = dest < from ? -1 : 1
  // Arriving: the ticked first, then the offered, in an order that then holds.
  if (to === 'organisation') {
    offerOrgs()
    orgOrder.value = [...orgRows.value.keys()]
  }
  at.value = to
  window.scrollTo({ top: 0 })
}

// Once a slide is in, the box to type in has focus (it's labelled by the
// question, so a screen reader hears that first), keeping the keyboard up
// from one question to the next where the phone allows. Without one, the
// question does. Not on All good?: its message box is optional.
function settled() {
  if (!at.value) return introEl.value?.title?.focus()
  const box =
    at.value !== 'review' &&
    document.querySelector<HTMLElement>('[data-slide] :is(input[type=text], input:not([type]), [role=combobox])')
  ;(box || heading.value)?.focus()
}

// (Still searching, there's no town box yet: picking a venue fills it in.)
async function flag() {
  error.value =
    at.value === 'venue' && venueStep.value?.mode === 'search' ? 'Search for the venue, or add just the town.' : ((at.value && MISSING[at.value]) ?? null)
  await nextTick()
  document.querySelector<HTMLElement>('[data-slide] [aria-invalid="true"]')?.focus()
}

// Enter moves on from anywhere on a slide, as from a text box: the question,
// a day, a country. (Not from a button, which Enter presses, or the message.)
function onEnter(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (e.isComposing || target.closest('button, textarea, input, select, a, dialog')) return
  e.preventDefault()
  advance()
}

// The slide asked for is on screen: until then (it slides in after the last
// one slides out), a second tap or Enter waits rather than skipping it.
const slideEl = ref<HTMLElement | null>(null)
const showing = () => !at.value || slideEl.value?.dataset.slideName === at.value

function advance() {
  // Enter in a sheet's search (another country, an organisation) is that
  // sheet's, not a nudge on to the next question.
  if (document.activeElement?.closest('dialog')) return
  if (!showing()) return
  // A venue picked from the search is still being looked up.
  if (at.value === 'venue' && venueStep.value?.busy) return
  if (at.value === 'registration' && regUnread.value && !regWarned.value) {
    regWarned.value = true
    return
  }
  if (!at.value) return start()
  if (at.value === 'review') return send()
  if (at.value === 'venue') venueStep.value?.settle()
  if (!OPTIONAL.has(at.value) && !answered[at.value]()) return flag()
  if (returning.value) {
    returning.value = false
    return go('review')
  }
  go(SLIDES[index.value + 1])
}

function previous() {
  if (!showing()) return
  if (returning.value) {
    returning.value = false
    return go('review')
  }
  go(index.value > 0 ? SLIDES[index.value - 1] : null)
}

function change(slide: Slide) {
  returning.value = true
  go(slide)
}

// Sending checks every answer, not just the last look: a draft can reopen
// with something since gone missing. It goes back to the first that is.
async function send() {
  const missing = SLIDES.find((s) => s !== 'review' && !OPTIONAL.has(s) && !answered[s]())
  if (missing) {
    returning.value = true
    go(missing)
    await nextTick()
    return flag()
  }
  if (!form.agree) return flag()
  // A double tap sends it once.
  if (sending.value || sent.value) return
  sending.value = true
  sendError.value = null
  const t = (v: string) => v.trim() || null
  const where = form.country ? countryChoice(form.country) : null
  const picked = Object.fromEntries(
    Object.entries(place.value ?? {}).filter(([, v]) => v != null),
  )
  try {
    // Through write(), which says so when offline rather than waiting for signal.
    await write({
      [`competitions:submissions/${newKey()}`]: {
        competition: {
          name: t(form.name),
          date: form.date,
          venue: t(form.venue),
          address: t(form.address),
          location: t(form.location),
          sobhd: t(form.sobhd),
          // The country asked, as the venue search would put it, unless
          // the venue was picked from it.
          ...(where && {
            country: where.iso,
            ...(where.region && { region: where.region }),
          }),
          ...picked,
        },
        contact: {
          name: t(form.contactName),
          email: me.email,
          message: t(form.message),
          disclaimer: true,
        },
        // Only when chosen, so a submission without any is as it always was.
        ...(hosts.ids.length && {
          organisations: Object.fromEntries(hosts.ids.map((id) => [id, true])),
        }),
        ...(hosts.fresh.length && {
          newOrganisations: Object.fromEntries(
            hosts.fresh.map((o) => [
              newKey(),
              { name: o.name, shortName: o.shortName || null },
            ]),
          ),
        }),
        submitted: new Date().toISOString(),
        // Emails about it are v4's, linking back here (functions/src/utility/emailModel.ts).
        origin: window.location.origin,
      },
    })
    // On to "Sent", as the slides go.
    direction.value = 1
    sent.value = true
    window.scrollTo({ top: 0 })
    clearDraft()
  } catch (e) {
    sendError.value = friendlyError(e)
  } finally {
    sending.value = false
  }
}

// The next one is often at the same venue, run by the same people: that
// (and you) stay.
function another() {
  Object.assign(form, { name: '', date: '', sobhd: '', message: '', agree: false })
  returning.value = false
  sent.value = false
  go('date')
}

// The one button at the foot: what it says, and how loudly.
const action = computed(() => {
  if (!at.value)
    return {
      label: !auth.isSignedIn
        ? 'Sign in to start'
        : resumeAt.value
          ? 'Pick up where you left off'
          : 'Start',
      variant: 'primary' as const,
    }
  if (at.value === 'review')
    return { label: 'Send', variant: 'primary' as const, icon: Send }
  if (at.value === 'registration' && regWarned.value && regUnread.value) return { label: 'Continue anyway', variant: 'primary' as const }
  if (returning.value) return { label: 'Back to review', variant: 'primary' as const }
  if (OPTIONAL.has(at.value) && !answered[at.value]())
    return { label: 'Skip', variant: 'tonal' as const }
  return { label: 'Continue', variant: 'primary' as const }
})

// --- The last look

// A day short enough to sit on one line: "Sat, Oct 24, 2026".
const shortDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

const review = computed(() => {
  const country = form.country ? countryChoice(form.country) : null
  return [
    {
      slide: 'country' as const,
      label: 'Country',
      lines: [country ? `${country.flag} ${country.name}` : ''],
    },
    {
      slide: 'date' as const,
      label: 'Date',
      lines: [form.date ? shortDay.format(parseDate(form.date)) : ''],
    },
    { slide: 'name' as const, label: 'Name', lines: [form.name] },
    {
      slide: 'organisation' as const,
      label: chosenOrgs.value.length > 1 ? 'Organisations' : 'Organisation',
      lines: chosenOrgs.value.map((h) =>
        h.fresh ? `${h.org.name} (new)` : (h.org.name ?? ''),
      ),
    },
    {
      slide: 'venue' as const,
      label: 'Venue',
      lines: [form.venue, form.address, form.location],
    },
    { slide: 'registration' as const, label: 'Registration', lines: [regUnread.value ? form.sobhd : regTidy.value.value] },
    {
      slide: 'contact' as const,
      label: 'Your name',
      lines: [form.contactName, me.email ?? ''],
    },
  ].map((r) => ({ ...r, lines: r.lines.map((l) => l.trim()).filter(Boolean) }))
})

// --- Drafts

// The answers so far outlast a reload (on this device, for this account)
// until they're sent. The intro then offers to pick up where they were.
const resumeAt = ref<Slide | null>(null)
const draftKey = () => `submit:draft:${auth.uid}`
const ANSWERS = [
  'date',
  'name',
  'venue',
  'address',
  'location',
  'sobhd',
  'message',
] as const
const hasAnswers = () =>
  ANSWERS.some((k) => !!form[k].trim()) || hosts.ids.length > 0 || hosts.fresh.length > 0
watch(
  [form, place, at, hosts],
  () => {
    if (!auth.uid || sent.value) return
    try {
      if (hasAnswers())
        localStorage.setItem(
          draftKey(),
          // (On the intro, still the slide it was left on.)
          JSON.stringify({ v: 2, form, place: place.value, at: at.value ?? resumeAt.value, hosts }),
        )
      else localStorage.removeItem(draftKey())
    } catch {
      // Private browsing: no draft.
    }
  },
  { deep: true },
)
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey()) ?? 'null')
    if (!saved?.form) return
    for (const k of Object.keys(form) as Array<keyof typeof form>) {
      const v = saved.form[k]
      if (
        v !== '' &&
        v != null &&
        (typeof v === typeof form[k] || (k === 'country' && typeof v === 'string'))
      )
        Object.assign(form, { [k]: v })
    }
    place.value = saved.place ?? null
    if (Array.isArray(saved.hosts?.ids)) hosts.ids = saved.hosts.ids
    if (Array.isArray(saved.hosts?.fresh)) hosts.fresh = saved.hosts.fresh
    hosts.offered = !!saved.hosts?.offered
    // An older draft (from the four steps) starts again at the first question.
    if (hasAnswers()) resumeAt.value = SLIDES.includes(saved.at) ? saved.at : 'country'
  } catch {
    // Private browsing, or nothing readable: start afresh.
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(draftKey())
  } catch {
    // Private browsing: nothing saved.
  }
}

// Each account starts from its own draft (or the intro). Signing in from the
// intro's button goes straight on to the first question.
let startOnSignIn = false
function start() {
  if (!auth.isSignedIn) {
    startOnSignIn = true
    // (As an organiser: the sheet says why, and a new account's "how do you
    // use the app?" waits rather than covering the first question.)
    auth.openLogin({ reason: 'submit' })
    return
  }
  const to = resumeAt.value ?? 'country'
  resumeAt.value = null
  go(to)
}
function reset() {
  Object.assign(form, blank(), {
    contactName: me.displayName ?? '',
    country: startingCountry(),
  })
  place.value = null
  hosts.ids = []
  hosts.fresh = []
  hosts.offered = false
  error.value = null
  at.value = null
  returning.value = false
  resumeAt.value = null
  sent.value = false
}
watch(
  () => auth.uid,
  (uid) => {
    reset()
    if (!uid) return
    restore()
    if (startOnSignIn) start()
    startOnSignIn = false
  },
  { immediate: true },
)
watch(
  () => me.displayName,
  (n) => {
    if (n && !form.contactName) form.contactName = n
  },
)
function startOver() {
  clearDraft()
  reset()
  go('country')
}

// The intro's own big title hands over to the bar once it scrolls away.
const introEl = ref<{ title: HTMLElement | null } | null>(null)
const scrolledPast = useScrolledPast(computed(() => introEl.value?.title ?? null))
const onIntro = computed(() => auth.authReady && !sent.value && !at.value)

const registration = computed(() => registrationHint(form.country))

// The number as it'll be saved (the server tidies it the same way), shown as
// it's typed. One it can't read gets a single "are you sure?": the first
// Continue says so and stays, the next carries on, since a person looks at
// it before it's approved anyway.
const regTidy = computed(() => tidyRegistration(form.sobhd, form.date ? Number(form.date.slice(0, 4)) : null))
const regUnread = computed(() => !!form.sobhd.trim() && regTidy.value.unread.length > 0)
const regSaved = computed(() => (regUnread.value ? [] : registrations(regTidy.value.value)))
const regWarned = ref(false)
watch(
  () => form.sobhd,
  () => (regWarned.value = false),
)

// The venue's helper says what the way it's being asked needs.
const venueHelp = computed(() => {
  if (place.value) return 'Check it’s the right one.'
  const mode = venueStep.value?.mode ?? 'search'
  if (mode === 'town') return 'Just the town, until the venue’s booked.'
  if (mode === 'typed') return 'Only the town is needed. The venue and address help families find it.'
  return 'Search, then pick it from the list. If it isn’t booked yet, the town is enough.'
})

// The button's foot shows a hairline only while something scrolls under it.
const end = ref<HTMLElement | null>(null)
const atEnd = ref(true)
useIntersectionObserver(end, ([entry]) => (atEnd.value = !!entry?.isIntersecting))
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar
      title="Add your competition"
      :show-title="!onIntro || scrolledPast"
      :back="!at || sent"
      :scrolled="false"
      :fallback="{ to: { name: 'competitions' }, label: 'Competitions' }"
    >
      <template v-if="at && !sent" #leading>
        <button
          v-tap-feedback
          v-proximity
          type="button"
          data-nav="back"
          class="glass press-glass proximity text-primary pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full [view-transition-name:nav-back]"
          :aria-label="returning ? 'Back to review' : index > 0 ? 'Back to the previous question' : 'Back to the start'"
          @click="previous"
        >
          <ChevronLeft class="size-6 -translate-x-px" stroke-width="2.5" />
        </button>
      </template>
      <!-- Ends where the questions do, on wide screens too. -->
      <template v-if="at && !sent" #middle>
        <div class="flex min-w-0 flex-1 items-center px-2">
          <div
            role="progressbar"
            aria-label="Progress"
            aria-valuemin="1"
            :aria-valuemax="SLIDES.length"
            :aria-valuenow="index + 1"
            :aria-valuetext="`Step ${index + 1} of ${SLIDES.length}`"
            class="bg-border h-1.5 flex-1 overflow-hidden rounded-full lg:max-w-[33rem]"
          >
            <span
              class="bg-primary-fill ease-snappy block h-full origin-left rounded-full transition-transform duration-(--dur-slow) motion-reduce:transition-none"
              :style="{ transform: `scaleX(${(index + 1) / SLIDES.length})` }"
            />
          </div>
        </div>
      </template>
    </AppBar>

    <!-- One column, at the bar's left edge on wide screens, as wide as a question needs. -->
    <main class="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-[calc(var(--chrome-top)+1rem)] lg:max-w-3xl">
      <div v-if="!auth.authReady" class="max-w-xl space-y-4" aria-busy="true">
        <span class="sr-only">Loading…</span>
        <Skeleton class="h-10 w-2/3" />
        <Skeleton class="h-56 w-full rounded-2xl!" />
      </div>

      <form v-else class="flex flex-1 flex-col" novalidate @submit.prevent="advance" @keydown.enter="onEnter">
        <!-- Each slide slides a little the way you're going. -->
        <Transition
          mode="out-in"
          enter-active-class="transition-[translate,opacity] duration-(--dur-base) ease-snappy motion-reduce:transition-opacity"
          :enter-from-class="`opacity-0 motion-reduce:translate-x-0 ${direction > 0 ? 'translate-x-6' : '-translate-x-6'}`"
          leave-active-class="transition-[translate,opacity] duration-(--dur-quick) ease-exit motion-reduce:transition-opacity"
          :leave-to-class="`opacity-0 motion-reduce:translate-x-0 ${direction > 0 ? '-translate-x-6' : 'translate-x-6'}`"
          @before-leave="(el) => ((el as HTMLElement).inert = true)"
          @after-enter="settled"
        >
          <div v-if="sent" key="sent" class="max-w-xl space-y-4 py-10 text-center">
            <SentMark class="mx-auto size-14" />
            <h1 class="text-display">Sent</h1>
            <p class="text-muted-foreground mx-auto max-w-md text-base text-pretty">
              Thanks. It’s usually approved overnight. You’ll get an email at {{ me.email }} with a link to start adding the details.
            </p>
            <p class="text-muted-foreground mx-auto max-w-md text-sm">If it doesn’t arrive, check your junk folder.</p>
          </div>

          <SubmitIntro
            v-else-if="!at"
            ref="introEl"
            key="intro"
            :draft="resumeAt ? { name: form.name, date: form.date } : null"
            class="max-w-xl pb-6"
            @start-over="startOver"
          />

          <div v-else :key="at" ref="slideEl" data-slide :data-slide-name="at" class="max-w-xl space-y-6 pb-6">
            <header class="space-y-2">
              <h1 id="slide-question" ref="heading" tabindex="-1" class="text-display text-balance outline-none">
                <span class="sr-only">Step {{ index + 1 }} of {{ SLIDES.length }}: </span>
                <template v-if="at === 'country'">Which country is it in?</template>
                <template v-else-if="at === 'date'">When is it?</template>
                <template v-else-if="at === 'name'">What’s it called?</template>
                <template v-else-if="at === 'organisation'">Who’s running it?</template>
                <template v-else-if="at === 'venue'">Where is it?</template>
                <template v-else-if="at === 'registration'">What’s its registration number?</template>
                <template v-else-if="at === 'contact'">What’s your name?</template>
                <template v-else>All good?</template>
              </h1>
              <p v-if="at !== 'country'" class="text-muted-foreground text-base text-pretty">
                <template v-if="at === 'date'">If it runs over a few days, pick the first.</template>
                <template v-else-if="at === 'name'">As dancers and families will see it.</template>
                <template v-else-if="at === 'organisation'">An association, games society or series. Its page on ScotDance.app lists everything it runs.</template>
                <template v-else-if="at === 'venue'">{{ venueHelp }}</template>
                <template v-else-if="at === 'registration'">From {{ registration.body }}. If you don’t have it handy, add it later.</template>
                <template v-else-if="at === 'contact'">So replies reach the right person. It’s never shown publicly.</template>
                <template v-else>Tap anything to change it.</template>
              </p>
            </header>

            <template v-if="at === 'country'">
              <CountryPicker v-model="form.country" labelledby="slide-question" />
              <p v-if="error" class="text-destructive text-sm font-medium" role="alert">{{ error }}</p>
            </template>

            <template v-else-if="at === 'date'">
              <DayPicker v-model="form.date" labelledby="slide-question" />
              <p v-if="error" class="text-destructive text-sm font-medium" role="alert">{{ error }}</p>
              <p v-else-if="form.date" class="text-base font-semibold" aria-live="polite">{{ formatLongDate(form.date) }}</p>
            </template>

            <template v-else-if="at === 'name'">
              <input
                v-model="form.name"
                type="text"
                aria-labelledby="slide-question"
                :aria-invalid="!!error || undefined"
                :aria-describedby="error ? 'slide-error' : undefined"
                aria-required="true"
                autocomplete="off"
                autocapitalize="words"
                enterkeyhint="next"
                :placeholder="nameExample(form.country)"
                class="field placeholder:text-muted-foreground h-12 w-full rounded-xl px-3 text-base"
              />
              <p v-if="error" id="slide-error" class="text-destructive -mt-4 text-sm font-medium" role="alert">{{ error }}</p>
            </template>

            <template v-else-if="at === 'organisation'">
              <div v-if="orderedOrgRows.length" class="surface divide-y overflow-hidden rounded-2xl">
                <button
                  v-for="row in orderedOrgRows"
                  :key="row.key"
                  type="button"
                  role="checkbox"
                  :aria-checked="row.checked"
                  class="press-row focus-inset flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                  @click="toggleOrg(row)"
                >
                  <OrganisationMark :organisation="row.org" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-semibold">{{ row.org.name }}</span>
                    <span class="text-muted-foreground block truncate text-sm">{{ row.fresh ? 'New: you’ll be its admin' : [row.org.shortName, row.org.location].filter(Boolean).join(' · ') }}</span>
                  </span>
                  <Checkbox :checked="row.checked" />
                </button>
              </div>
              <button
                type="button"
                class="surface press-row focus-inset text-primary flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left"
                @click="pickingOrg.show($event)"
              >
                <span class="bg-blue-paper flex size-10 shrink-0 items-center justify-center rounded-xl" aria-hidden="true"><Plus class="size-5" /></span>
                <span class="flex-1 text-base font-semibold">{{ orderedOrgRows.length ? 'Find or add another' : 'Find or add an organisation' }}</span>
              </button>
              <OrganisationPicker
                :morph="pickingOrg"
                :mine="me.managedOrganisationIds"
                :chosen="hosts.ids"
                any
                create-hint="It’s made when your competition is approved, with you as its admin."
                @pick="addHost"
                @create="addFreshHost"
              />
            </template>

            <VenueStep
              v-else-if="at === 'venue'"
              ref="venueStep"
              v-model:venue="form.venue"
              v-model:address="form.address"
              v-model:location="form.location"
              v-model:place="place"
              :country="form.country"
              :error="error"
              @switched="error = null"
            />

            <template v-else-if="at === 'registration'">
              <input
                v-model="form.sobhd"
                type="text"
                aria-labelledby="slide-question"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                enterkeyhint="next"
                :placeholder="registration.example ? `e.g. ${registration.example}` : undefined"
                :aria-describedby="regWarned && regUnread ? 'slide-error' : regSaved.length ? 'slide-saved' : undefined"
                class="field placeholder:text-muted-foreground h-12 w-full rounded-xl px-3 text-base"
              />
              <p v-if="regWarned && regUnread" id="slide-error" class="-mt-4 text-sm font-medium" role="alert">
                <template v-if="registration.example">That doesn’t match the usual format, like <span class="whitespace-nowrap">{{ registration.example }}</span>.</template>
                <template v-else>That isn’t a format ScotDance.app knows.</template>
                Check it, or continue anyway: it’ll get a look before it’s approved.
              </p>
              <p v-else-if="regSaved.length" id="slide-saved" class="text-muted-foreground -mt-4 flex gap-1.5 text-sm" aria-live="polite">
                <Check class="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <span v-for="r in regSaved" :key="r.number" class="block">{{ r.association ? `${registrationLabel(r)}: ${r.number}` : `Saved as ${r.number}` }}</span>
                </span>
              </p>
            </template>

            <template v-else-if="at === 'contact'">
              <input
                v-model="form.contactName"
                type="text"
                aria-labelledby="slide-question"
                :aria-invalid="!!error || undefined"
                :aria-describedby="error ? 'slide-error' : undefined"
                aria-required="true"
                autocomplete="name"
                enterkeyhint="next"
                class="field placeholder:text-muted-foreground h-12 w-full rounded-xl px-3 text-base"
              />
              <p v-if="error" id="slide-error" class="text-destructive -mt-4 text-sm font-medium" role="alert">{{ error }}</p>
            </template>

            <template v-else>
              <ul class="surface divide-y overflow-hidden rounded-2xl">
                <li v-for="r in review" :key="r.slide">
                  <button type="button" class="press-row focus-inset flex min-h-14 w-full items-start gap-3 py-3 pr-3 pl-4 text-left" @click="change(r.slide)">
                    <span class="text-muted-foreground text-callout w-24 shrink-0 pt-px">{{ r.label }}</span>
                    <span class="min-w-0 flex-1 text-base break-words">
                      <template v-if="r.lines.length">
                        <span v-for="(line, i) in r.lines" :key="i" :class="['block', i > 0 && 'text-muted-foreground text-callout']">{{ line }}</span>
                      </template>
                      <span v-else class="text-muted-foreground">Not added</span>
                    </span>
                    <ChevronRight class="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <span class="sr-only">Change</span>
                  </button>
                </li>
              </ul>
              <div class="space-y-1.5">
                <label for="slide-message" class="text-callout font-medium">Anything to ask or mention?</label>
                <!-- Two lines to start, growing with what's typed. -->
                <textarea
                  id="slide-message"
                  v-model="form.message"
                  rows="2"
                  aria-describedby="slide-message-note"
                  class="field placeholder:text-muted-foreground field-sizing-content min-h-[4.5rem] w-full resize-none rounded-xl px-3 py-2.5 text-base"
                />
                <p id="slide-message-note" class="text-muted-foreground text-sm">Only the reviewer sees it.</p>
              </div>
              <button
                type="button"
                role="checkbox"
                :aria-checked="form.agree"
                :aria-invalid="!!error || undefined"
                class="surface press-row focus-inset flex w-full items-start gap-3 rounded-2xl p-4 text-left"
                @click="form.agree = !form.agree"
              >
                <Checkbox :checked="form.agree" class="mt-0.5" />
                <span>
                  <!-- (Balanced, and kept whole where a split reads badly, so no word sits alone on a line.) -->
                  <span class="block text-base font-medium text-balance">I accept it comes <span class="whitespace-nowrap">as is</span>, with no guarantees</span>
                  <span class="text-muted-foreground block text-sm text-pretty">ScotDance.app is free and <span class="whitespace-nowrap">volunteer-run</span>. You’re in control of what goes online for your competition, like dancers and results.</span>
                  <span v-if="error" class="text-destructive block pt-1 text-sm font-medium" role="alert">{{ error }}</span>
                </span>
              </button>
            </template>
          </div>
        </Transition>

        <span ref="end" aria-hidden="true" />
        <!-- The one button, at the foot of the screen on phones (a hairline
             only while something scrolls under it), under the question on
             wide screens. -->
        <div
          :class="[
            'bg-background sticky bottom-0 z-10 -mx-4 mt-auto px-4 pt-3 pb-[calc(1rem+var(--safe-bottom))] transition-[border-color] duration-(--dur-quick) lg:static lg:mx-0 lg:mt-2 lg:max-w-xl lg:border-transparent lg:px-0',
            'border-t',
            atEnd ? 'border-transparent' : 'border-border',
          ]"
        >
          <p v-if="sendError" class="text-destructive pb-3 font-medium" role="alert">{{ sendError }}</p>
          <p v-if="!at && !sent && !auth.isSignedIn" class="text-muted-foreground pb-3 text-sm text-pretty">Any email address works. You’ll manage the competition from the same account.</p>
          <template v-if="sent">
            <Button variant="plain" block class="mb-1" @click="another">Add another</Button>
            <Button variant="primary" size="lg" block :to="{ name: 'competitions' }">Back to competitions</Button>
          </template>
          <Button v-else type="submit" :variant="action.variant" size="lg" block :busy="sending">
            <component :is="action.icon" v-if="action.icon && !sending" />
            {{ action.label }}
          </Button>
        </div>
      </form>
    </main>
  </div>
</template>
