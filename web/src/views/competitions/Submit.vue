<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight, CircleCheck, LoaderCircle, Plus, Send } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Skeleton from '@/components/Skeleton.vue'
import FormInput from '@/components/admin/FormInput.vue'
import StepNav from '@/components/submit/StepNav.vue'
import SubmitOverview from '@/components/submit/SubmitOverview.vue'
import VenueField from '@/components/admin/VenueField.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { friendlyError, newKey, write } from '@/lib/admin/write'
import { formatLongDate } from '@/lib/format'
import { placesAvailable, type VenueFields } from '@/lib/maps'
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
        submitted: new Date().toISOString(),
      },
    })
    sent.value = true
    clearDraft()
    window.scrollTo({ top: 0 })
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
  sent.value = false
  void go(0)
}

const summary = computed(() =>
  [
    { step: 0, title: 'Details', lines: [form.name, formatLongDate(form.date), form.sobhd && `Registration: ${form.sobhd}`] },
    { step: 0, title: 'Description', lines: [form.description] },
    { step: 1, title: 'Venue', lines: [form.venue, form.address, form.location] },
    { step: 2, title: 'Contact', lines: [form.contactName, me.email] },
    { step: 2, title: 'Message', lines: [form.message] },
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
  [form, place, step],
  () => {
    if (!auth.uid || sent.value) return
    try {
      if (ANSWERS.some(filled)) localStorage.setItem(draftKey(), JSON.stringify({ form, place: place.value, step: step.value }))
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
  if (auth.isSignedIn) return go(0)
  startOnSignIn = true
  auth.openLogin({ reason: 'account' })
}
function reset() {
  Object.assign(form, blank(), { contactName: me.displayName ?? '' })
  Object.assign(adding, { sobhd: false, description: false, message: false })
  place.value = null
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

const addButton = 'text-primary hover:bg-accent -mx-3 flex h-11 w-fit items-center gap-1.5 rounded-xl px-3 text-[0.9375rem] font-bold'
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Submit a competition" show-title :fallback="{ to: { name: 'competitions' }, label: 'Competitions' }" />
    <main :class="['mx-auto w-full max-w-xl flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+1.5rem)]', overview && 'lg:max-w-3xl']">
      <div v-if="!auth.authReady" class="space-y-4" aria-busy="true">
        <span class="sr-only">Loading…</span>
        <Skeleton class="h-8 w-2/3" />
        <Skeleton class="h-48 w-full rounded-2xl!" />
      </div>

      <div v-else-if="sent" class="space-y-4 py-10 text-center">
        <CircleCheck class="text-done-foreground mx-auto size-14" />
        <h1 class="text-display">Submitted</h1>
        <p class="text-muted-foreground mx-auto max-w-md text-base">
          Thanks. It’s usually approved overnight. You’ll get an email at {{ me.email }} with a link to start adding the details.
        </p>
        <p class="text-muted-foreground mx-auto max-w-md text-sm">If it doesn’t arrive, check your junk folder.</p>
        <div class="flex flex-col items-center gap-2 pt-2">
          <RouterLink :to="{ name: 'competitions' }" class="bg-primary-fill text-primary-foreground h-12 content-center rounded-xl px-6 text-base font-bold">Back to competitions</RouterLink>
          <button type="button" class="text-primary h-11 font-bold" @click="another">Submit another</button>
        </div>
      </div>

      <SubmitOverview v-else-if="overview" :steps="STEPS" :signed-in="auth.isSignedIn" @start="start" />

      <div v-else class="space-y-6">
        <h1 class="text-display">Submit a competition</h1>
        <p v-if="restored" class="bg-blue-paper flex items-center justify-between gap-3 rounded-xl pl-4 text-[0.9375rem] font-semibold">
          Picked up where you left off.
          <button type="button" class="text-primary h-11 shrink-0 rounded-xl px-4 font-bold" @click="startOver">Start over</button>
        </p>
        <StepNav :steps="STEPS.map((s) => s.title)" :current="step" @go="jump" />

        <form class="space-y-6" novalidate @submit.prevent="next">
          <header class="space-y-1">
            <h2 ref="heading" tabindex="-1" class="text-title outline-none">
              <span class="sr-only">Step {{ step + 1 }} of {{ STEPS.length }}: </span>{{ STEPS[step].title }}
            </h2>
            <p class="text-muted-foreground text-base">{{ STEPS[step].lead }}</p>
          </header>

          <div v-if="step === 0" class="space-y-4">
            <FormInput v-model="form.name" label="Name" required placeholder="e.g. Canadian Championship 2027" :error="errors.name" />
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
              hint="Optional: if it’s registered with an association, like the RSOBHD."
            />
            <div class="flex flex-wrap gap-x-6">
              <button v-if="!adding.description && !form.description" type="button" :class="addButton" @click="add('description')">
                <Plus class="size-4" /> Add a description
              </button>
              <button v-if="!adding.sobhd && !form.sobhd" type="button" :class="addButton" @click="add('sobhd')">
                <Plus class="size-4" /> Add registration number
              </button>
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
              <p class="text-[0.9375rem] font-bold">Your email</p>
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
            <button v-else type="button" :class="addButton" @click="add('message')"><Plus class="size-4" /> Add a message</button>
          </div>

          <div v-else class="space-y-4">
            <dl class="bg-card divide-y rounded-2xl border shadow-sm">
              <div v-for="s in summary" :key="s.title" class="flex items-start gap-2 py-3 pr-2 pl-4">
                <div class="min-w-0 flex-1">
                  <dt class="text-muted-foreground text-sm font-bold">{{ s.title }}</dt>
                  <dd v-for="(line, i) in s.lines" :key="i" class="text-base break-words whitespace-pre-line">{{ line }}</dd>
                </div>
                <button type="button" class="text-primary hover:bg-accent h-11 shrink-0 rounded-xl px-3 text-[0.9375rem] font-bold" @click="go(s.step)">
                  Edit<span class="sr-only"> {{ s.title }}</span>
                </button>
              </div>
            </dl>
            <label class="bg-card flex items-start gap-3 rounded-2xl border p-4">
              <input v-model="form.agree" type="checkbox" :aria-invalid="!!errors.agree || undefined" class="accent-primary mt-1 size-5 shrink-0" />
              <span>
                <span class="block text-base font-bold">I understand ScotDance is run by a volunteer</span>
                <span class="text-muted-foreground block text-sm">It’s offered as is, with no guarantees of any kind.</span>
                <span v-if="errors.agree" class="text-destructive block pt-1 text-sm font-semibold" role="alert">{{ errors.agree }}</span>
              </span>
            </label>
          </div>

          <p v-if="sendError" class="text-destructive font-semibold" role="alert">{{ sendError }}</p>
          <div class="flex gap-3">
            <button
              v-if="step > 0"
              type="button"
              :disabled="sending"
              class="bg-card border-strong hover:bg-accent flex h-12 items-center gap-1 rounded-xl border pr-5 pl-3 text-base font-bold disabled:opacity-50"
              @click="go(step - 1)"
            >
              <ChevronLeft class="size-5" /> Back
            </button>
            <button type="submit" :disabled="sending" class="bg-primary-fill text-primary-foreground flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-base font-bold disabled:opacity-50">
              <template v-if="step < STEPS.length - 1">Next <ChevronRight class="-mr-1 size-5" /></template>
              <template v-else>
                <LoaderCircle v-if="sending" class="size-5 animate-spin" />
                <Send v-else class="size-5" />
                Submit
              </template>
            </button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>
