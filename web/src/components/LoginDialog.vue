<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Eye, EyeOff } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import Dialog from '@/components/Dialog.vue'

// Sign-in, asked for at the moment it matters (tapping Follow) and saying so.
// Email and password, as in v3, the same in the browser and the apps; phones
// fill both in from their saved passwords (with Face ID or a fingerprint).
type Step = 'signin' | 'register' | 'forgot'

const auth = useAuthStore()
const step = ref<Step>('signin')
const email = ref('')
const password = ref('')
const passwordVisible = ref(false)
const busy = ref(false)
const errorMessage = ref<string | null>(null)
const infoMessage = ref<string | null>(null)

const heading = computed(() => {
  if (step.value === 'register') return 'Create an account'
  if (step.value === 'forgot') return 'Reset your password'
  const r = auth.loginReason
  if (r?.reason === 'follow' && r.name) return `Sign in to follow ${r.name.split(' ')[0]}`
  if (r?.reason === 'alerts') return 'Sign in to get alerts'
  if (r?.reason === 'submit') return 'Sign in to submit a competition'
  // The Follow star on judges, competitions and the like.
  if (r?.reason === 'favorite') return r.name ? `Sign in to follow ${r.name}` : 'Sign in to follow this'
  return 'Sign in to ScotDance'
})
// What following gets you; an organiser submitting has read why already.
const benefits = computed(() => {
  const r = auth.loginReason
  if (r?.reason === 'submit') return []
  const first = r?.reason === 'follow' ? r.name?.split(' ')[0] : undefined
  return [
    first ? `See ${first}’s day on your Home screen` : 'See your dancers’ day on your Home screen',
    'Get an alert when placings are posted',
    'Your dancers on every device',
  ]
})

watch(
  () => auth.loginDialogOpen,
  (open) => {
    if (open) go('signin')
  },
)

watch(
  () => auth.isSignedIn,
  (signedIn) => {
    if (signedIn && auth.loginDialogOpen) {
      auth.closeLogin()
      password.value = ''
    }
  },
)

function go(next: Step) {
  step.value = next
  errorMessage.value = null
  infoMessage.value = null
  passwordVisible.value = false
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match. Check them, or choose “Forgot your password?”'
    case 'auth/email-already-in-use':
      return 'That email already has an account. Choose “Back to sign in” to use its password.'
    case 'auth/too-many-requests':
      return 'Too many tries for now. Wait a few minutes, then try again.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/invalid-email':
      return 'That email address doesn’t look right. Check it for typos.'
    case 'auth/network-request-failed':
      return 'No connection. Check your signal and try again.'
    default:
      return 'Sign-in didn’t work. Try again.'
  }
}

async function submit() {
  errorMessage.value = null
  infoMessage.value = null
  busy.value = true
  try {
    if (step.value === 'signin') await auth.signInWithEmail(email.value, password.value)
    else if (step.value === 'register') await auth.registerWithEmail(email.value, password.value)
    else {
      await auth.resetPassword(email.value)
      infoMessage.value = `A reset link is on its way to ${email.value}.`
    }
  } catch (e) {
    errorMessage.value = friendly(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Dialog :open="auth.loginDialogOpen" :morph="auth.loginSheet" variant="sheet" @close="auth.closeLogin()">
    <template #header>
      <h2 class="text-title">{{ heading }}</h2>
    </template>

    <form class="space-y-3 p-4 pb-[calc(1.5rem+var(--safe-bottom))]" @submit.prevent="submit">
      <ul v-if="step === 'signin' && benefits.length" class="space-y-2 pb-1">
        <li v-for="b in benefits" :key="b" class="flex gap-2.5 text-base">
          <Check class="text-done-foreground mt-0.5 size-5 shrink-0" stroke-width="2.6" />
          {{ b }}
        </li>
      </ul>

      <label class="block space-y-1.5">
        <span class="text-[0.9375rem] font-bold">Email address</span>
        <input
          v-model="email"
          type="email"
          name="email"
          autocomplete="username"
          inputmode="email"
          required
          class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 px-3 text-base outline-none"
        />
      </label>

      <label v-if="step !== 'forgot'" class="block space-y-1.5">
        <span class="text-[0.9375rem] font-bold">{{ step === 'register' ? 'Choose a password' : 'Password' }}</span>
        <span class="relative block">
          <input
            v-model="password"
            :type="passwordVisible ? 'text' : 'password'"
            name="password"
            :autocomplete="step === 'register' ? 'new-password' : 'current-password'"
            required
            class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 pr-24 pl-3 text-base outline-none"
          />
          <button
            type="button"
            class="text-primary absolute top-1/2 right-1 flex h-10 -translate-y-1/2 items-center gap-1 rounded-lg px-2 text-sm font-bold"
            @click="passwordVisible = !passwordVisible"
          >
            <component :is="passwordVisible ? EyeOff : Eye" class="size-4" />
            {{ passwordVisible ? 'Hide' : 'Show' }}
          </button>
        </span>
      </label>

      <p v-if="errorMessage" class="text-destructive text-[0.9375rem] font-semibold" role="alert">
        {{ errorMessage }}
      </p>
      <p v-if="infoMessage" class="text-done-foreground text-[0.9375rem] font-semibold" role="status">
        {{ infoMessage }}
      </p>

      <button
        type="submit"
        :disabled="busy"
        class="bg-primary-fill text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-60"
      >
        <template v-if="busy">Working…</template>
        <template v-else-if="step === 'signin'">Sign in</template>
        <template v-else-if="step === 'register'">Create account</template>
        <template v-else>Send reset link</template>
      </button>

      <div class="space-y-1 text-center text-[0.9375rem]">
        <template v-if="step === 'signin'">
          <button type="button" class="text-primary block h-11 w-full font-bold" @click="go('forgot')">
            Forgot your password?
          </button>
          <button type="button" class="text-primary block h-11 w-full font-bold" @click="go('register')">
            New here? Create an account
          </button>
        </template>
        <button v-else type="button" class="text-primary h-11 font-bold" @click="go('signin')">
          Back to sign in
        </button>
      </div>
    </form>
  </Dialog>
</template>
