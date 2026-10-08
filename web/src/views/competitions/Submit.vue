<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Plus, Send, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Skeleton from '@/components/Skeleton.vue'
import FormInput from '@/components/admin/FormInput.vue'
import StepNav from '@/components/submit/StepNav.vue'
import SentMark from '@/components/submit/SentMark.vue'
import SubmitOverview from '@/components/submit/SubmitOverview.vue'
import VenueField from '@/components/admin/VenueField.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import OrganisationPicker from '@/components/OrganisationPicker.vue'
import { useOrganisations } from '@/composables/useOrganisations'
import { useMorph } from '@/lib/morph'
import { organisationLabel, type OrganisationListItem } from '@/types/organisation'
import { usePageTitle } from '@/composables/usePageTitle'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { friendlyError, newKey, write } from '@/lib/admin/write'
import { formatLongDate } from '@/lib/format'
import { placesAvailable, type VenueFields } from '@/lib/maps'
import { moveInPlace } from '@/lib/navMotion'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Organisers ask for their competition to be added: an overview, then a few
// questions at a time. Once it's approved they get access to manage it, and
// an email saying so. Signed in only: they manage it from the same account,
// and the venue search (billed per use) isn't for passers-by.

usePageTitle(['Submit a competition'])
const auth = useAuthStore()
const me = useMeStore()

const blank = () => ({
  name: '',
  date: '',
  venue: '',
  address: '',
  location: '',
  sobhd: '',
  description: '',
  contactName: '',
  message: '',
  agree: false,
})
const form = reactive(blank())
type Field = keyof typeof form
const errors = reactive<Partial<Record<Field, string | null>>>({})

// Choosing the venue from its suggestions also puts the competition on the
// map and in "near me" once it's approved. A bare address has no name: it
// goes in the address field instead.
const place = ref<Pick<VenueFields, 'lat' | 'lng' | 'country' | 'region' | 'locality'> | null>(null)
function pickVenue({ venue, address, location, ...rest }: VenueFields) {
  form.venue = venue ?? ''
  if (address) form.address = address
  if (location) form.location = location
  place.value = rest
}

// The organisations it's run by or part of: ones already on ScotDance.app
// (yours first; any other is checked when it's approved), or new ones,
// made when it's approved, with you as their admin.
const orgs = useOrganisations()
const hosts = reactive({ ids: [] as string[], fresh: [] as Array<{ name: string; shortName: string }> })
const pickingOrg = useMorph()
const chosenOrgs = computed(() => [
  ...hosts.ids.flatMap((id) => {
    const org = orgs.byId.value.get(id)
    return org ? [{ key: id, org, fresh: false }] : []
  }),
  ...hosts.fresh.map((org, i) => ({ key: `new-${i}`, org: { ...org, image: null, location: null }, fresh: true })),
])
// One tap, right under the name, for any organisation it mentions ("CHDA
// Fall Competition": by short name or full name, as whole words). Yours come
// first in the picker.
const words = (s?: string | null) => ` ${(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `
const quickOrgs = computed(() => {
  const name = words(form.name)
  return orgs.organisations.value.filter(
    (o) => !hosts.ids.includes(o.id) && [o.shortName, o.name].some((s) => words(s).trim().length >= 3 && name.includes(words(s))),
  )
})
function addHost(org: OrganisationListItem) {
  if (!hosts.ids.includes(org.id)) hosts.ids.push(org.id)
}
function addFreshHost(org: { name: string; shortName: string }) {
  const known = orgs.organisations.value.find((o) => o.name?.trim().toLowerCase() === org.name.trim().toLowerCase())
  if (known) addHost(known)
  else hosts.fresh.push(org)
}
function removeHost(key: string) {
  if (key.startsWith('new-')) hosts.fresh.splice(Number(key.slice(4)), 1)
  else hosts.ids = hosts.ids.filter((id) => id !== key)
}

// Optional bits stay tucked away until asked for (or already filled in).
const adding = reactive({ sobhd: false, description: false, message: false })

// What each step asks (in short, for the overview) and says at its top.
const STEPS = [
  {
    title: 'Details',
    asks: 'Name and date',
    lead: 'The competition’s name and date, as dancers and families will see them.',
  },
  {
    title: 'Venue',
    asks: 'Where it’s held',
    lead: 'If it isn’t settled yet, the town or city is enough.',
  },
  {
    title: 'Contact',
    asks: 'Your name, kept private',
    lead: 'Only used to contact you about this submission. None of it is shown publicly.',
  },
  {
    title: 'Review',
    asks: 'A last look before sending',
    lead: 'Make sure it all looks right. You can change any of it once it’s approved.',
  },
]
const REQUIRED: Array<Array<[Field, string]>> = [
  [
    ['name', 'Add the competition’s name.'],
    ['date', 'Add the date.'],
  ],
  [['location', 'Add the town or city.']],
  [['contactName', 'Add your name.']],
  [['agree', 'Tick this to continue.']],
]
// The overview comes first, then the steps.
const started = ref(false)
const step = ref(0)
const heading = ref<HTMLElement | null>(null)
// Which way the steps move: forward slides in from the right, back from the left.
const direction = ref<1 | -1>(1)

const filled = (k: Field) => (k === 'agree' ? form.agree : !!String(form[k]).trim())
const complete = (s: number) => REQUIRED[s].every(([k]) => filled(k))
function clearErrors() {
  for (const k of Object.keys(errors) as Field[]) errors[k] = null
}
// A message goes as soon as it's dealt with.
watch(form, () => {
  for (const k of Object.keys(errors) as Field[]) if (errors[k] && filled(k)) errors[k] = null
})

function add(key: keyof typeof adding) {
  adding[key] = true
  void nextTick(() => document.querySelector<HTMLElement>(`main [data-field="${key}"] :is(input, textarea)`)?.focus())
}

const sending = ref(false)
const sent = ref(false)
const sendError = ref<string | null>(null)
// Until they start (or while signed out), the overview shows instead of a step.
const overview = computed(() => auth.authReady && !sent.value && (!auth.isSignedIn || !started.value))

async function go(to: number) {
  clearErrors()
  sendError.value = null
  restored.value = false
  started.value = true
  direction.value = to < step.value ? -1 : 1
  step.value = to
  window.scrollTo({ top: 0 })
  await nextTick()
  heading.value?.focus()
}

// What's missing on a step, said beside each field.
async function flag(s: number) {
  for (const [k, message] of REQUIRED[s]) errors[k] = filled(k) ? null : message
  await nextTick()
  document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus()
}

// Back always works. Forward checks each step on the way, as Next does, and
// stops at the first with something missing.
async function jump(to: number) {
  let at = to
  for (let s = step.value; s < to; s++) {
    if (!complete(s)) {
      at = s
      break
    }
  }
  if (at !== step.value) await go(at)
  if (at < to) await flag(at)
}

async function next() {
  if (step.value < STEPS.length - 1) await jump(step.value + 1)
  else if (complete(step.value)) await submit()
  else await flag(step.value)
}

async function submit() {
  // A double tap sends it once.
  if (sending.value || sent.value) return
  sending.value = true
  sendError.value = null
  const t = (v: string) => v.trim() || null
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
          description: t(form.description),
          ...place.value,
        },
        contact: { name: t(form.contactName), email: me.email, message: t(form.message), disclaimer: true },
        // Only when chosen, so a submission without any is as it always was.
        ...(hosts.ids.length && { organisations: Object.fromEntries(hosts.ids.map((id) => [id, true])) }),
        ...(hosts.fresh.length && { newOrganisations: Object.fromEntries(hosts.fresh.map((o) => [newKey(), { name: o.name, shortName: o.shortName || null }])) }),
        submitted: new Date().toISOString(),
        // Emails about it are v4's, linking back here (functions/src/utility/emailModel.ts).
        origin: window.location.origin,
      },
    })
    // On to "Submitted", as a page would go.
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

// The next one is often at the same venue: that (and you) stay.
function another() {
  Object.assign(form, { name: '', date: '', sobhd: '', description: '', message: '', agree: false })
  Object.assign(adding, { sobhd: false, description: false, message: false })
  moveInPlace({ way: 'swap', axis: 'x' }, () => {
    sent.value = false
    return go(0)
  })
}

const summary = computed(() =>
  [
    { step: 0, title: 'Details', lines: [form.name, formatLongDate(form.date), form.sobhd && `Registration: ${form.sobhd}`] },
    { step: 0, title: 'Description', lines: [form.description] },
    { step: 1, title: 'Venue', lines: [form.venue, form.address, form.location] },
    { step: 2, title: 'Contact', lines: [form.contactName, me.email] },
    { step: 2, title: 'Message', lines: [form.message] },
    { step: 0, title: 'Organisations', lines: chosenOrgs.value.map((h) => (h.fresh ? `${h.org.name} (new: you’ll be its admin)` : h.org.name ?? '')) },
  ]
    .map((s) => ({ ...s, lines: s.lines.map((l) => (l || '').trim()).filter(Boolean) }))
    .filter((s) => s.lines.length),
)

// The answers so far outlast a reload (on this device, for this account)
// until they're sent. A draft picks up at its step, past the overview.
const restored = ref(false)
const draftKey = () => `submit:draft:${auth.uid}`
const ANSWERS: Field[] = ['name', 'date', 'venue', 'address', 'location', 'sobhd', 'description', 'message']
watch(
  [form, place, step, hosts],
  () => {
    if (!auth.uid || sent.value) return
    try {
      if (ANSWERS.some(filled)) localStorage.setItem(draftKey(), JSON.stringify({ form, place: place.value, step: step.value, hosts }))
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
    for (const k of Object.keys(form) as Field[]) {
      if (typeof saved.form[k] === typeof form[k] && saved.form[k] !== '') Object.assign(form, { [k]: saved.form[k] })
    }
    place.value = saved.place ?? null
    if (Array.isArray(saved.hosts?.ids)) hosts.ids = saved.hosts.ids
    if (Array.isArray(saved.hosts?.fresh)) hosts.fresh = saved.hosts.fresh
    step.value = STEPS[saved.step] ? Number(saved.step) : 0
    started.value = ANSWERS.some(filled)
    restored.value = started.value
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

// Each account starts from its own draft (or the overview). Signing in from
// the overview's button goes straight on to the first step.
let startOnSignIn = false
function start() {
  if (auth.isSignedIn) return moveInPlace({ way: 'forward', axis: 'x' }, () => go(0))
  startOnSignIn = true
  auth.openLogin({ reason: 'account' })
}
function reset() {
  Object.assign(form, blank(), { contactName: me.displayName ?? '' })
  Object.assign(adding, { sobhd: false, description: false, message: false })
  place.value = null
  hosts.ids = []
  hosts.fresh = []
  clearErrors()
  started.value = false
  step.value = 0
  sent.value = false
  restored.value = false
}
watch(
  () => auth.uid,
  (uid) => {
    reset()
    if (!uid) return
    restore()
    if (startOnSignIn) {
      started.value = true
      window.scrollTo({ top: 0 })
    }
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
  reset()
  clearDraft()
  void go(0)
}

// The overview's own big title hands over to the bar once it scrolls away;
// the steps and the sent screen have the bar's title alone.
const overviewEl = ref<{ title: HTMLElement | null } | null>(null)
const scrolledPast = useScrolledPast(computed(() => overviewEl.value?.title ?? null))
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Submit a competition" :show-title="!overview || scrolledPast" :fallback="{ to: { name: 'competitions' }, label: 'Competitions' }" />
    <main :class="['mx-auto w-full max-w-xl flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+1.5rem)]', overview && 'lg:max-w-3xl']">
      <div v-if="!auth.authReady" class="space-y-4" aria-busy="true">
        <span class="sr-only">Loading…</span>
        <Skeleton class="h-8 w-2/3" />
        <Skeleton class="h-48 w-full rounded-2xl!" />
      </div>

      <div v-else-if="sent" class="space-y-4 py-10 text-center">
        <SentMark class="mx-auto size-14" />
        <h1 class="text-display">Submitted</h1>
        <p class="text-muted-foreground mx-auto max-w-md text-base">
          Thanks. It’s usually approved overnight. You’ll get an email at {{ me.email }} with a link to start adding the details.
        </p>
        <p class="text-muted-foreground mx-auto max-w-md text-sm">If it doesn’t arrive, check your junk folder.</p>
        <div class="flex flex-col items-center gap-2 pt-2">
          <Button variant="primary" size="lg" :to="{ name: 'competitions' }">Back to competitions</Button>
          <Button variant="plain" @click="another">Submit another</Button>
        </div>
      </div>

      <SubmitOverview v-else-if="overview" :steps="STEPS" :signed-in="auth.isSignedIn" ref="overviewEl" @start="start" />

      <div v-else class="space-y-6">
        <p v-if="restored" class="bg-blue-paper text-callout flex items-center justify-between gap-3 rounded-xl pl-4 font-medium">
          Picked up where you left off.
          <Button variant="plain" class="shrink-0" @click="startOver">Start over</Button>
        </p>
        <StepNav :steps="STEPS.map((s) => s.title)" :current="step" @go="jump" />

        <form class="space-y-6" novalidate @submit.prevent="next">
          <!-- Each step slides a little the way you're going. -->
          <Transition
            mode="out-in"
            enter-active-class="transition-[translate,opacity] duration-(--dur-base) ease-snappy motion-reduce:transition-opacity"
            :enter-from-class="`opacity-0 motion-reduce:translate-x-0 ${direction > 0 ? 'translate-x-6' : '-translate-x-6'}`"
            leave-active-class="transition-[translate,opacity] duration-(--dur-quick) ease-exit motion-reduce:transition-opacity"
            :leave-to-class="`opacity-0 motion-reduce:translate-x-0 ${direction > 0 ? '-translate-x-6' : 'translate-x-6'}`"
            @enter="heading?.focus()"
          >
            <div :key="step" class="space-y-6">
              <header class="space-y-1">
                <h2 ref="heading" tabindex="-1" class="text-title outline-none">
                  <span class="sr-only">Step {{ step + 1 }} of {{ STEPS.length }}: </span>{{ STEPS[step].title }}
                </h2>
                <p class="text-muted-foreground text-base">{{ STEPS[step].lead }}</p>
              </header>

              <div v-if="step === 0" class="space-y-4">
                <FormInput v-model="form.name" label="Name" required placeholder="e.g. Canadian Championship 2027" :error="errors.name" />
                <div v-if="quickOrgs.length" class="-mt-2 flex flex-wrap gap-2">
                  <Button v-for="org in quickOrgs" :key="org.id" variant="tonal" size="sm" @click="addHost(org)">
                    <Plus /> Add {{ organisationLabel(org) }}
                  </Button>
                </div>
                <FormInput v-model="form.date" label="Date" kind="date" required hint="The first day, if it runs over several." :error="errors.date" />
                <FormInput
                  v-if="adding.description || form.description"
                  v-model="form.description"
                  data-field="description"
                  label="Description"
                  kind="textarea"
                  hint="Optional: anything else people should know. It’s shown on the competition page."
                />
                <FormInput
                  v-if="adding.sobhd || form.sobhd"
                  v-model="form.sobhd"
                  data-field="sobhd"
                  label="Registration number"
                  placeholder="e.g. C-AB-CO-27-1234"
                  hint="Optional: if it’s registered with an association, like the RSOBHD. For several, separate them with commas."
                />
                <div v-if="chosenOrgs.length" class="space-y-1.5">
                  <p class="text-callout font-medium">Organisations</p>
                  <ul class="surface divide-y overflow-hidden rounded-2xl">
                    <li v-for="h in chosenOrgs" :key="h.key" class="flex min-h-15 items-center gap-3 py-2 pr-1 pl-3">
                      <OrganisationMark :organisation="h.org" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-base font-semibold">{{ h.org.name }}</span>
                        <span class="text-muted-foreground block truncate text-sm">{{ h.fresh ? 'New: you’ll be its admin' : [h.org.shortName, h.org.location].filter(Boolean).join(' · ') }}</span>
                      </span>
                      <button type="button" class="text-muted-foreground press flex size-11 shrink-0 items-center justify-center rounded-full" :aria-label="`Remove ${h.org.name}`" @click="removeHost(h.key)">
                        <X class="size-5" />
                      </button>
                    </li>
                  </ul>
                </div>
                <div class="-mx-4 flex flex-wrap gap-x-2">
                  <Button v-if="!adding.description && !form.description" variant="plain" @click="add('description')">
                    <Plus /> Add a description
                  </Button>
                  <Button v-if="!adding.sobhd && !form.sobhd" variant="plain" @click="add('sobhd')">
                    <Plus /> Add registration number
                  </Button>
                  <Button variant="plain" @click="pickingOrg.show($event)">
                    <Plus /> {{ chosenOrgs.length ? 'Add another organisation' : 'Add an organisation' }}
                  </Button>
                  <OrganisationPicker
                    :morph="pickingOrg"
                    :mine="me.managedOrganisationIds"
                    :chosen="hosts.ids"
                    any
                    create-hint="It’s made when your competition is approved, with you as its admin."
                    @pick="addHost"
                    @create="addFreshHost"
                  />
                </div>
              </div>

              <div v-else-if="step === 1" class="space-y-4">
                <VenueField v-if="placesAvailable" v-model="form.venue" @pick="pickVenue" />
                <FormInput v-else v-model="form.venue" label="Venue name" placeholder="e.g. Telus Convention Centre" />
                <FormInput v-model="form.address" label="Address" placeholder="e.g. 120 9th Ave SE" />
                <FormInput v-model="form.location" label="Town or city" required placeholder="e.g. Calgary, AB" hint="Include the province or state." :error="errors.location" />
              </div>

              <div v-else-if="step === 2" class="space-y-4">
                <FormInput v-model="form.contactName" label="Your name" required autocomplete="name" :error="errors.contactName" />
                <div class="space-y-1.5">
                  <p class="text-callout font-medium">Your email</p>
                  <p class="text-base break-words">{{ me.email }}</p>
                  <p class="text-muted-foreground text-sm">From your account.</p>
                </div>
                <FormInput
                  v-if="adding.message || form.message"
                  v-model="form.message"
                  data-field="message"
                  label="Message"
                  kind="textarea"
                  hint="Optional: questions or notes."
                />
                <Button v-else variant="plain" class="-ml-4" @click="add('message')"><Plus /> Add a message</Button>
              </div>

              <div v-else class="space-y-4">
                <dl class="surface divide-y rounded-2xl">
                  <div v-for="s in summary" :key="s.title" class="flex items-start gap-2 py-3 pr-2 pl-4">
                    <div class="min-w-0 flex-1">
                      <dt class="text-muted-foreground text-sm font-medium">{{ s.title }}</dt>
                      <dd v-for="(line, i) in s.lines" :key="i" class="text-base break-words whitespace-pre-line">{{ line }}</dd>
                    </div>
                    <Button variant="plain" @click="go(s.step)">
                      Edit<span class="sr-only"> {{ s.title }}</span>
                    </Button>
                  </div>
                </dl>
                <button
                  type="button"
                  role="checkbox"
                  :aria-checked="form.agree"
                  :aria-invalid="!!errors.agree || undefined"
                  class="surface press-row focus-inset flex w-full items-start gap-3 rounded-2xl p-4 text-left"
                  @click="form.agree = !form.agree"
                >
                  <Checkbox :checked="form.agree" class="mt-0.5" />
                  <span>
                    <!-- (Balanced, and kept whole where a split reads badly, so no word sits alone on a line.) -->
                    <span class="block text-base font-medium text-balance">I accept it comes <span class="whitespace-nowrap">as is</span>, with no guarantees</span>
                    <span class="text-muted-foreground block text-sm text-pretty">ScotDance.app is free and <span class="whitespace-nowrap">volunteer-run</span>. You’re in control of what goes online for your competition, like dancers and results.</span>
                    <span v-if="errors.agree" class="text-destructive block pt-1 text-sm font-medium" role="alert">{{ errors.agree }}</span>
                  </span>
                </button>
              </div>
            </div>
          </Transition>

          <p v-if="sendError" class="text-destructive font-medium" role="alert">{{ sendError }}</p>
          <div class="flex gap-3">
            <Button v-if="step > 0" size="lg" class="pl-4" :disabled="sending" @click="go(step - 1)">
              <ChevronLeft /> Back
            </Button>
            <Button type="submit" variant="primary" size="lg" class="flex-1" :busy="sending">
              <template v-if="step < STEPS.length - 1">Next <ChevronRight /></template>
              <template v-else>
                <Send v-if="!sending" />
                Submit
              </template>
            </Button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>
