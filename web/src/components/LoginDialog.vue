<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Eye, EyeOff, Mail } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import Dialog from '@/components/Dialog.vue'

// Sign-in, asked for at the moment it matters (tapping Follow) and saying so.
// One tap with Apple or Google; or an email step that sends a sign-in link,
// with a password option for existing accounts (v3 accounts all have one).
type Step = 'choose' | 'email' | 'password' | 'register' | 'forgot' | 'link-sent'

const auth = useAuthStore()
const step = ref<Step>('choose')
const email = ref('')
const password = ref('')
const passwordVisible = ref(false)
const busy = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const infoMessage = ref<string | null>(null)

const reason = computed(() => auth.loginReason)
const heading = computed(() => {
  const r = reason.value
  if (r?.reason === 'follow' && r.name) return `Sign in to follow ${r.name.split(' ')[0]}`
  if (r?.reason === 'alerts') return 'Sign in to get alerts'
  if (r?.reason === 'favorite') return 'Sign in to save this'
  return 'Sign in to ScotDance'
})
const benefits = computed(() => {
  const first = reason.value?.name?.split(' ')[0]
  return [
    first ? `See ${first}’s day on your Home screen` : 'See your dancers’ day on your Home screen',
    'Get an alert when placings are posted',
    'Your dancers on every device',
  ]
})

watch(
  () => auth.loginDialogOpen,
  (open) => {
    if (open) {
      step.value = 'choose'
      errorMessage.value = null
      infoMessage.value = null
      passwordVisible.value = false
    }
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
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match. Check them, or use “Email me a sign-in link” instead.'
    case 'auth/email-already-in-use':
      return 'That email already has an account. Choose “Use my password” or “Email me a sign-in link”.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/invalid-email':
      return 'That email address doesn’t look right. Check it for typos.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Try again when you’re ready.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.'
    case 'auth/operation-not-allowed':
      return 'This sign-in option isn’t switched on yet. Use your email instead.'
    case 'auth/network-request-failed':
      return 'No connection. Check your signal and try again.'
    default:
      return 'Sign-in didn’t work. Try again, or use your email instead.'
  }
}

async function run(key: string, fn: () => Promise<unknown>) {
  errorMessage.value = null
  busy.value = key
  try {
    await fn()
  } catch (e) {
    errorMessage.value = friendly(e)
  } finally {
    busy.value = null
  }
}

const withProvider = (p: 'apple' | 'google') => run(p, () => auth.signInWithProvider(p))
const sendLink = () =>
  run('link', async () => {
    await auth.sendSignInLink(email.value)
    go('link-sent')
  })
const signIn = () => run('password', () => auth.signInWithEmail(email.value, password.value))
const register = () => run('register', () => auth.registerWithEmail(email.value, password.value))
const reset = () =>
  run('forgot', async () => {
    await auth.resetPassword(email.value)
    infoMessage.value = `A reset link is on its way to ${email.value}.`
  })
</script>

<template>
  <Dialog :open="auth.loginDialogOpen" variant="sheet" @close="auth.closeLogin()">
    <template #header>
      <h2 class="text-title">
        <template v-if="step === 'choose'">{{ heading }}</template>
        <template v-else-if="step === 'register'">Create an account</template>
        <template v-else-if="step === 'forgot'">Reset your password</template>
        <template v-else-if="step === 'link-sent'">Check your email</template>
        <template v-else>Continue with email</template>
      </h2>
    </template>

    <div class="space-y-4 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <template v-if="step === 'choose'">
        <ul class="space-y-2">
          <li v-for="b in benefits" :key="b" class="flex gap-2.5 text-base">
            <Check class="text-done-foreground mt-0.5 size-5 shrink-0" stroke-width="2.6" />
            {{ b }}
          </li>
        </ul>
        <div class="space-y-2.5">
          <button
            type="button"
            class="bg-foreground text-background flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold disabled:opacity-60"
            :disabled="!!busy"
            @click="withProvider('apple')"
          >
            <svg viewBox="0 0 24 24" class="size-5 fill-current" aria-hidden="true"><path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.59 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.83-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.33-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z"/></svg>
            {{ busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple' }}
          </button>
          <button
            type="button"
            class="bg-card border-strong flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-base font-bold disabled:opacity-60"
            :disabled="!!busy"
            @click="withProvider('google')"
          >
            <svg viewBox="0 0 24 24" class="size-5" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.19-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.9 3.25-4.72 3.25-8.09z"/><path fill="#34A853" d="M12 23c2.96 0 5.44-.98 7.25-2.64l-3.54-2.75c-.98.66-2.23 1.05-3.71 1.05-2.85 0-5.27-1.93-6.13-4.52H2.21v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.87 14.14A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.46.37-2.14V7.02H2.21A11 11 0 0 0 1 12c0 1.78.43 3.46 1.21 4.98l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.61 0 3.06.55 4.2 1.64l3.14-3.14C17.44 2.1 14.96 1 12 1A11 11 0 0 0 2.21 7.02l3.66 2.84C6.73 7.3 9.15 5.38 12 5.38z"/></svg>
            {{ busy === 'google' ? 'Opening Google…' : 'Continue with Google' }}
          </button>
          <button
            type="button"
            class="bg-card border-strong flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-base font-bold"
            @click="go('email')"
          >
            <Mail class="size-5" /> Continue with email
          </button>
        </div>
        <p class="text-muted-foreground text-center text-sm">Free. No password needed.</p>
      </template>

      <form
        v-else-if="step === 'email' || step === 'password' || step === 'register' || step === 'forgot'"
        class="space-y-3"
        @submit.prevent="step === 'email' ? sendLink() : step === 'password' ? signIn() : step === 'register' ? register() : reset()"
      >
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

        <label v-if="step === 'password' || step === 'register'" class="block space-y-1.5">
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
          :disabled="!!busy"
          class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-60"
        >
          <template v-if="busy">Working…</template>
          <template v-else-if="step === 'email'">Email me a sign-in link</template>
          <template v-else-if="step === 'password'">Sign in</template>
          <template v-else-if="step === 'register'">Create account</template>
          <template v-else>Send reset link</template>
        </button>

        <div class="space-y-1 text-center text-[0.9375rem]">
          <button v-if="step === 'email'" type="button" class="text-primary h-11 font-bold" @click="go('password')">
            I have a password
          </button>
          <template v-else-if="step === 'password'">
            <button type="button" class="text-primary block h-11 w-full font-bold" @click="go('forgot')">
              Forgot your password?
            </button>
            <button type="button" class="text-primary block h-11 w-full font-bold" @click="go('register')">
              New here? Create an account
            </button>
          </template>
          <button v-else type="button" class="text-primary h-11 font-bold" @click="go('password')">
            Back to sign in
          </button>
          <button
            type="button"
            class="text-muted-foreground block h-11 w-full font-semibold"
            @click="go('choose')"
          >
            Other ways to sign in
          </button>
        </div>
      </form>

      <div v-else-if="step === 'link-sent'" class="space-y-4 text-base">
        <p>
          A sign-in link is on its way to <b>{{ email }}</b>. Open it on this phone and you’ll be signed in.
        </p>
        <p class="text-muted-foreground text-[0.9375rem]">
          It can take a minute. Check your junk folder if it doesn’t arrive.
        </p>
        <button
          type="button"
          class="bg-card border-strong h-12 w-full rounded-xl border text-base font-bold"
          @click="go('email')"
        >
          Use a different email
        </button>
      </div>

      <p v-if="step === 'choose' && errorMessage" class="text-destructive text-[0.9375rem] font-semibold" role="alert">
        {{ errorMessage }}
      </p>
    </div>
  </Dialog>
</template>
