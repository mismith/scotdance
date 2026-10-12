<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Plus, Send } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Skeleton from '@/components/Skeleton.vue'
import FormInput from '@/components/admin/FormInput.vue'
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
import { formatLongDate } from '@/lib/format'
import { guessUserCountry } from '@/lib/locale'
import { type VenuePlace } from '@/lib/maps'
import { useMorph } from '@/lib/morph'
import { moveInPlace } from '@/lib/navMotion'
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
  if (to === 'organisation') offerOrgs()
  at.value = to
  window.scrollTo({ top: 0 })
}

// Once a slide is in: its question has focus, for screen readers. With a
// mouse and keyboard (no on-screen keyboard to cover the page), the box to
// type in does instead.
function settled() {
  const typing =
    matchMedia('(pointer: fine)').matches &&
    document.querySelector<HTMLElement>(
      '[data-slide] :is(input[type=text], input:not([type]), textarea)',
    )
  ;(typing || heading.value)?.focus()
}

// (Still searching, there's no town box yet: picking a venue fills it in.)
async function flag() {
  error.value =
    at.value === 'venue' && venueStep.value?.mode === 'search' ? 'Search for the venue, or add just the town.' : ((at.value && MISSING[at.value]) ?? null)
  await nextTick()
  document.querySelector<HTMLElement>('[data-slide] [aria-invalid="true"]')?.focus()
}

function advance() {
  // Enter in a sheet's search (another country, an organisation) is that
  // sheet's, not a nudge on to the next question.
  if (document.activeElement?.closest('dialog')) return
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
    // On to "Sent", as a page would go.
    moveInPlace({ way: 'forward', axis: 'x' }, () => {
      sent.value = true
      window.scrollTo({ top: 0 })
    })
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
  moveInPlace({ way: 'swap', axis: 'x' }, () => {
    sent.value = false
    go('date')
  })
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
  if (returning.value) return { label: 'Back to review', variant: 'primary' as const }
  if (OPTIONAL.has(at.value) && !answered[at.value]())
    return { label: 'Skip', variant: 'tonal' as const }
  return { label: 'Continue', variant: 'primary' as const }
})

// --- The last look

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
      lines: [form.date ? formatLongDate(form.date) : ''],
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
    { slide: 'registration' as const, label: 'Registration', lines: [form.sobhd] },
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
          JSON.stringify({ v: 2, form, place: place.value, at: at.value, hosts }),
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
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar
      title="Add a competition"
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
          :aria-label="
            returning
              ? 'Back to review'
              : index > 0
                ? 'Back to the previous question'
                : 'Back to the start'
          "
          @click="previous"
        >
          <ChevronLeft class="size-6 -translate-x-px" stroke-width="2.5" />
        </button>
      </template>
      <template v-if="at && !sent" #middle>
        <div class="flex min-w-0 flex-1 items-center px-2">
          <div
            role="progressbar"
            aria-label="Progress"
            aria-valuemin="1"
            :aria-valuemax="SLIDES.length"
            :aria-valuenow="index + 1"
            :aria-valuetext="`Step ${index + 1} of ${SLIDES.length}`"
            class="bg-border h-1.5 flex-1 overflow-hidden rounded-full"
          >
            <span
              class="bg-primary-fill ease-snappy block h-full origin-left rounded-full transition-transform duration-(--dur-slow) motion-reduce:transition-none"
              :style="{ transform: `scaleX(${(index + 1) / SLIDES.length})` }"
            />
          </div>
        </div>
      </template>
    </AppBar>

    <main
      class="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-[calc(var(--chrome-top)+1rem)]"
    >
      <div v-if="!auth.authReady" class="space-y-4" aria-busy="true">
        <span class="sr-only">Loading…</span>
        <Skeleton class="h-10 w-2/3" />
        <Skeleton class="h-56 w-full rounded-2xl!" />
      </div>

      <div v-else-if="sent" class="space-y-4 py-10 text-center">
        <SentMark class="mx-auto size-14" />
        <h1 class="text-display">Sent</h1>
        <p class="text-muted-foreground mx-auto max-w-md text-base">
          Thanks. It’s usually approved overnight. You’ll get an email at
          {{ me.email }} with a link to start adding the details.
        </p>
        <p class="text-muted-foreground mx-auto max-w-md text-sm">
          If it doesn’t arrive, check your junk folder.
        </p>
        <div class="flex flex-col items-center gap-2 pt-2">
          <Button variant="primary" size="lg" :to="{ name: 'competitions' }"
            >Back to competitions</Button
          >
          <Button variant="plain" @click="another">Add another</Button>
        </div>
      </div>

      <form v-else class="flex flex-1 flex-col" novalidate @submit.prevent="advance">
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
          <SubmitIntro
            v-if="!at"
            ref="introEl"
            key="intro"
            :signed-in="auth.isSignedIn"
            :draft="resumeAt ? { name: form.name, date: form.date } : null"
            class="pb-6"
            @start-over="startOver"
          />

          <div v-else :key="at" data-slide :data-slide-name="at" class="space-y-6 pb-6">
            <header class="space-y-2">
              <h1
                id="slide-question"
                ref="heading"
                tabindex="-1"
                class="text-display text-balance outline-none"
              >
                <span class="sr-only">Step {{ index + 1 }} of {{ SLIDES.length }}: </span>
                <template v-if="at === 'country'">Which country is it in?</template>
                <template v-else-if="at === 'date'">When is it?</template>
                <template v-else-if="at === 'name'">What’s it called?</template>
                <template v-else-if="at === 'organisation'">Who’s running it?</template>
                <template v-else-if="at === 'venue'">Where is it?</template>
                <template v-else-if="at === 'registration'"
                  >What’s its registration number?</template
                >
                <template v-else-if="at === 'contact'">What’s your name?</template>
                <template v-else>All good?</template>
              </h1>
              <p
                v-if="at !== 'country'"
                class="text-muted-foreground text-base text-pretty"
              >
                <template v-if="at === 'date'"
                  >If it runs over a few days, pick the first.</template
                >
                <template v-else-if="at === 'name'"
                  >As dancers and families will see it.</template
                >
                <template v-else-if="at === 'organisation'"
                  >An association, games society or series. Its page lists everything it
                  runs.</template
                >
                <template v-else-if="at === 'venue'"
                  >Search for the venue. If it isn’t booked yet, the town is
                  enough.</template
                >
                <template v-else-if="at === 'registration'"
                  >From {{ registration.body }}. If you don’t have it handy, add it
                  later.</template
                >
                <template v-else-if="at === 'contact'"
                  >So replies reach the right person. It’s never shown publicly.</template
                >
                <template v-else>Tap anything to change it.</template>
              </p>
            </header>

            <template v-if="at === 'country'">
              <CountryPicker v-model="form.country" labelledby="slide-question" />
              <p v-if="error" class="text-destructive text-sm font-medium" role="alert">
                {{ error }}
              </p>
            </template>

            <template v-else-if="at === 'date'">
              <DayPicker v-model="form.date" labelledby="slide-question" />
              <p v-if="error" class="text-destructive text-sm font-medium" role="alert">
                {{ error }}
              </p>
              <p
                v-else-if="form.date"
                class="text-center text-base font-semibold"
                aria-live="polite"
              >
                {{ formatLongDate(form.date) }}
              </p>
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
                class="field placeholder:text-muted-foreground h-14 w-full rounded-xl px-4 text-lg"
              />
              <p
                v-if="error"
                id="slide-error"
                class="text-destructive -mt-3 text-sm font-medium"
                role="alert"
              >
                {{ error }}
              </p>
            </template>

            <template v-else-if="at === 'organisation'">
              <div
                v-if="chosenOrgs.length || suggestedOrgs.length"
                class="surface divide-y overflow-hidden rounded-2xl"
              >
                <button
                  v-for="h in chosenOrgs"
                  :key="h.key"
                  type="button"
                  role="checkbox"
                  aria-checked="true"
                  class="press-row focus-inset flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                  @click="removeHost(h.key)"
                >
                  <OrganisationMark :organisation="h.org" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-semibold">{{
                      h.org.name
                    }}</span>
                    <span class="text-muted-foreground block truncate text-sm">{{
                      h.fresh
                        ? 'New: you’ll be its admin'
                        : [h.org.shortName, h.org.location].filter(Boolean).join(' · ')
                    }}</span>
                  </span>
                  <Checkbox :checked="true" />
                </button>
                <button
                  v-for="org in suggestedOrgs"
                  :key="org.id"
                  type="button"
                  role="checkbox"
                  aria-checked="false"
                  class="press-row focus-inset flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                  @click="addHost(org)"
                >
                  <OrganisationMark :organisation="org" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-semibold">{{
                      org.name
                    }}</span>
                    <span class="text-muted-foreground block truncate text-sm">{{
                      [org.shortName, org.location].filter(Boolean).join(' · ')
                    }}</span>
                  </span>
                  <Checkbox :checked="false" />
                </button>
              </div>
              <button
                type="button"
                class="surface press-row focus-inset text-primary flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left"
                @click="pickingOrg.show($event)"
              >
                <span
                  class="bg-blue-paper flex size-10 shrink-0 items-center justify-center rounded-xl"
                  aria-hidden="true"
                  ><Plus class="size-5"
                /></span>
                <span class="flex-1 text-base font-semibold">{{
                  chosenOrgs.length || suggestedOrgs.length
                    ? 'Find or add another'
                    : 'Find or add an organisation'
                }}</span>
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
                :placeholder="
                  registration.example ? `e.g. ${registration.example}` : undefined
                "
                class="field placeholder:text-muted-foreground h-14 w-full rounded-xl px-4 text-lg"
              />
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
                class="field placeholder:text-muted-foreground h-14 w-full rounded-xl px-4 text-lg"
              />
              <p
                v-if="error"
                id="slide-error"
                class="text-destructive -mt-3 text-sm font-medium"
                role="alert"
              >
                {{ error }}
              </p>
            </template>

            <template v-else>
              <ul class="surface divide-y overflow-hidden rounded-2xl">
                <li v-for="r in review" :key="r.slide">
                  <button
                    type="button"
                    class="press-row focus-inset flex min-h-14 w-full items-center gap-3 py-2.5 pr-3 pl-4 text-left"
                    @click="change(r.slide)"
                  >
                    <span class="text-muted-foreground text-callout w-24 shrink-0">{{
                      r.label
                    }}</span>
                    <span class="min-w-0 flex-1 text-base break-words">
                      <template v-if="r.lines.length">
                        <span
                          v-for="(line, i) in r.lines"
                          :key="i"
                          :class="[
                            'block',
                            i > 0 && 'text-muted-foreground text-callout',
                          ]"
                          >{{ line }}</span
                        >
                      </template>
                      <span v-else class="text-muted-foreground">Not added</span>
                    </span>
                    <ChevronRight
                      class="text-muted-foreground size-5 shrink-0"
                      aria-hidden="true"
                    />
                    <span class="sr-only">Change</span>
                  </button>
                </li>
              </ul>
              <FormInput
                v-model="form.message"
                label="Anything to ask or mention?"
                kind="textarea"
                hint="Only the reviewer sees it."
              />
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
                  <span class="block text-base font-medium text-balance"
                    >I accept it comes <span class="whitespace-nowrap">as is</span>, with
                    no guarantees</span
                  >
                  <span class="text-muted-foreground block text-sm text-pretty"
                    >ScotDance.app is free and
                    <span class="whitespace-nowrap">volunteer-run</span>. You’re in
                    control of what goes online for your competition, like dancers and
                    results.</span
                  >
                  <span
                    v-if="error"
                    class="text-destructive block pt-1 text-sm font-medium"
                    role="alert"
                    >{{ error }}</span
                  >
                </span>
              </button>
            </template>
          </div>
        </Transition>

        <!-- The one button, at the foot: it stays put while a long slide scrolls. -->
        <div
          class="from-background sticky bottom-0 z-10 -mx-4 mt-auto bg-linear-to-t from-[calc(100%-1.25rem)] to-transparent px-4 pt-5 pb-[calc(1rem+var(--safe-bottom))]"
        >
          <p v-if="sendError" class="text-destructive pb-3 font-medium" role="alert">
            {{ sendError }}
          </p>
          <Button type="submit" :variant="action.variant" size="lg" block :busy="sending">
            <component :is="action.icon" v-if="action.icon && !sending" />
            {{ action.label }}
          </Button>
        </div>
      </form>
    </main>
  </div>
</template>
