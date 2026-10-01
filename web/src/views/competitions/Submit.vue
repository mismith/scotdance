<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { push } from 'firebase/database'
import { CircleCheck, ClipboardList, LoaderCircle, Send, Wifi } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import FormInput from '@/components/admin/FormInput.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { dataRef } from '@/firebase'
import { friendlyError } from '@/lib/admin/write'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Organisers ask for their competition to be added. Once it's approved
// they get access to manage it, and an email saying so.

usePageTitle(['Submit a competition'])
const auth = useAuthStore()
const me = useMeStore()

const form = reactive({
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
const errors = reactive<Record<string, string | null>>({})
watch(
  () => me.displayName,
  (n) => {
    if (n && !form.contactName) form.contactName = n
  },
  { immediate: true },
)

const sending = ref(false)
const sent = ref(false)
const sendError = ref<string | null>(null)

const required: Array<[keyof typeof form, string]> = [
  ['name', 'Add the competition’s name.'],
  ['date', 'Add the date.'],
  ['location', 'Add the town or city.'],
  ['contactName', 'Add your name.'],
]

function validate() {
  for (const k of Object.keys(errors)) errors[k] = null
  let ok = true
  for (const [k, msg] of required) {
    if (!String(form[k]).trim()) {
      errors[k] = msg
      ok = false
    }
  }
  if (!form.agree) {
    errors.agree = 'Tick this to continue.'
    ok = false
  }
  return ok
}

async function submit() {
  if (!validate()) {
    // Jump to the first problem, which may be far up the page.
    await nextTick()
    const first = document.querySelector<HTMLElement>('main [aria-invalid="true"]')
    first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    first?.focus({ preventScroll: true })
    return
  }
  await auth.requireSignIn(async () => {
    sending.value = true
    sendError.value = null
    const t = (v: string) => v.trim() || null
    try {
      await push(dataRef('competitions:submissions'), {
        competition: {
          name: t(form.name),
          date: form.date,
          venue: t(form.venue),
          address: t(form.address),
          location: t(form.location),
          sobhd: t(form.sobhd),
          description: t(form.description),
        },
        contact: { name: t(form.contactName), email: me.email, message: t(form.message), disclaimer: true },
        submitted: new Date().toISOString(),
      })
      sent.value = true
      window.scrollTo({ top: 0 })
    } catch (e) {
      sendError.value = friendlyError(e)
    } finally {
      sending.value = false
    }
  })
}

function another() {
  const keep = { venue: form.venue, address: form.address, location: form.location }
  Object.assign(form, { name: '', date: '', sobhd: '', description: '', message: '', agree: false }, keep)
  sent.value = false
}

const STEPS = computed(() => [
  { icon: Send, title: 'Submit this form', text: 'It takes a few minutes. If you have an info sheet for the competition, you’re mostly done already.' },
  { icon: CircleCheck, title: 'Wait for approval', text: 'Usually overnight, and within a week at most. You’ll get an email.' },
  { icon: ClipboardList, title: 'Add the details', text: 'Import your dancers from Excel, add the age groups, dances and schedule. You can do it from a phone, but a laptop is easier.' },
  { icon: Wifi, title: 'Enter results on the day', text: 'Tap dancers in the order they’re announced. You’ll need Wi-Fi or mobile signal where you sit.' },
])
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Submit a competition" show-title :fallback="{ to: { name: 'competitions' }, label: 'Competitions' }" />
    <main class="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+1.5rem)]">
      <template v-if="sent">
        <div class="space-y-4 py-10 text-center">
          <CircleCheck class="text-done-foreground mx-auto size-14" />
          <h1 class="text-display">Submitted</h1>
          <p class="text-muted-foreground mx-auto max-w-md text-base">Thanks. You’ll get an email at {{ me.email }} when it’s approved, with a link to start adding the details.</p>
          <div class="flex flex-col items-center gap-2 pt-2">
            <RouterLink :to="{ name: 'competitions' }" class="bg-primary text-primary-foreground h-12 content-center rounded-xl px-6 text-base font-bold">Back to competitions</RouterLink>
            <button type="button" class="text-primary h-11 font-bold" @click="another">Submit another</button>
          </div>
        </div>
      </template>

      <template v-else>
        <header class="space-y-2">
          <h1 class="text-display">Submit a competition</h1>
          <p class="text-muted-foreground text-base">Run a Highland dancing competition? Add it here so dancers and families can follow along: the schedule, dancing order and results, live.</p>
        </header>

        <ol class="bg-card divide-y rounded-2xl border shadow-sm">
          <li v-for="(s, i) in STEPS" :key="s.title" class="flex gap-3 p-4">
            <span class="bg-blue-paper text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"><component :is="s.icon" class="size-5" /></span>
            <span>
              <span class="block text-base font-bold">{{ i + 1 }}. {{ s.title }}</span>
              <span class="text-muted-foreground block text-sm">{{ s.text }}</span>
            </span>
          </li>
        </ol>

        <form class="space-y-8" novalidate @submit.prevent="submit">
          <section class="space-y-4">
            <h2 class="text-heading">The competition</h2>
            <FormInput v-model="form.name" label="Name" required placeholder="e.g. Canadian Championship 2027" :error="errors.name" />
            <FormInput v-model="form.date" label="Date" kind="date" required hint="The first day, if it runs over several." :error="errors.date" />
            <FormInput v-model="form.venue" label="Venue" placeholder="e.g. Telus Convention Centre" />
            <FormInput v-model="form.address" label="Address" placeholder="e.g. 120 9th Ave SE" />
            <FormInput v-model="form.location" label="Town or city" required placeholder="e.g. Calgary, Alberta, Canada" :error="errors.location" />
            <FormInput v-model="form.sobhd" label="RSOBHD number" placeholder="e.g. C-AB-CO-27-1234" hint="If it’s registered with the RSOBHD." />
            <FormInput v-model="form.description" label="Anything else" kind="textarea" hint="Optional: details you’d like on the competition page." />
          </section>

          <section class="space-y-4">
            <h2 class="text-heading">You</h2>
            <FormInput v-model="form.contactName" label="Your name" required :error="errors.contactName" />
            <div class="space-y-1.5">
              <p class="text-[0.9375rem] font-bold">Your email</p>
              <p v-if="auth.isSignedIn" class="text-base">{{ me.email }}</p>
              <p class="text-muted-foreground text-sm">{{ auth.isSignedIn ? 'From your account. It isn’t shown publicly.' : 'You’ll sign in when you submit, so you can manage it once approved.' }}</p>
            </div>
            <FormInput v-model="form.message" label="Message" kind="textarea" hint="Optional: questions or notes." />
          </section>

          <label class="bg-card flex items-start gap-3 rounded-2xl border p-4">
            <input v-model="form.agree" type="checkbox" :aria-invalid="!!errors.agree || undefined" class="accent-primary mt-1 size-5 shrink-0" />
            <span>
              <span class="block text-base font-bold">I understand ScotDance is run by a volunteer</span>
              <span class="text-muted-foreground block text-sm">It’s offered as is, with no guarantees of any kind.</span>
              <span v-if="errors.agree" class="text-destructive block pt-1 text-sm font-semibold">{{ errors.agree }}</span>
            </span>
          </label>

          <p v-if="sendError" class="text-destructive font-semibold" role="alert">{{ sendError }}</p>
          <button type="submit" :disabled="sending" class="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold disabled:opacity-50">
            <LoaderCircle v-if="sending" class="size-5 animate-spin" />
            <Send v-else class="size-5" />
            {{ auth.isSignedIn ? 'Submit' : 'Sign in and submit' }}
          </button>
        </form>
      </template>
    </main>
  </div>
</template>
