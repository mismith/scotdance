<script setup lang="ts">
import { ref, watch } from 'vue'
import { Eye, EyeOff, X } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'

type Mode = 'login' | 'register' | 'forgot'

const auth = useAuthStore()
const mode = ref<Mode>('login')
const email = ref('')
const password = ref('')
const passwordVisible = ref(false)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

watch(
  () => auth.loginDialogOpen,
  (open) => {
    if (open) {
      mode.value = 'login'
      errorMessage.value = null
      successMessage.value = null
      passwordVisible.value = false
    }
  },
)

watch(
  () => auth.isSignedIn,
  (signedIn) => {
    if (signedIn && auth.loginDialogOpen) {
      auth.closeLogin()
      email.value = ''
      password.value = ''
    }
  },
)

function setMode(next: Mode) {
  mode.value = next
  errorMessage.value = null
  successMessage.value = null
}

async function submit() {
  errorMessage.value = null
  successMessage.value = null
  submitting.value = true
  try {
    if (mode.value === 'login') {
      await auth.signInWithEmail(email.value, password.value)
    } else if (mode.value === 'register') {
      await auth.registerWithEmail(email.value, password.value)
    } else {
      await auth.resetPassword(email.value)
      successMessage.value =
        'Check your email inbox for instructions to reset your password.'
    }
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    v-if="auth.loginDialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    @click.self="auth.closeLogin()"
  >
    <div
      class="bg-background relative w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-lg"
    >
      <button
        type="button"
        class="hover:bg-accent text-muted-foreground absolute top-2 right-2 flex size-11 items-center justify-center rounded-full"
        title="Close"
        @click="auth.closeLogin()"
      >
        <X class="size-4" />
      </button>

      <div class="space-y-1">
        <div
          class="text-foreground/65 text-xs text-eyebrow"
        >
          ScotDance.app
        </div>
        <h2 class="text-4xl font-medium tracking-tight leading-[1.04]">
          <template v-if="mode === 'login'">Sign in</template>
          <template v-else-if="mode === 'register'">Create account</template>
          <template v-else>Reset password</template>
        </h2>
      </div>

      <form class="space-y-3" @submit.prevent="submit">
        <label class="block space-y-1">
          <span class="text-muted-foreground">Email</span>
          <input
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            autofocus
            class="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
          />
        </label>

        <label v-if="mode !== 'forgot'" class="block space-y-1">
          <span class="text-muted-foreground">Password</span>
          <div class="relative">
            <input
              v-model="password"
              :type="passwordVisible ? 'text' : 'password'"
              name="password"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              required
              class="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 pr-10 focus:ring-2 focus:outline-none"
            />
            <button
              type="button"
              tabindex="-1"
              class="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1"
              @click="passwordVisible = !passwordVisible"
            >
              <component :is="passwordVisible ? EyeOff : Eye" class="size-4" />
            </button>
          </div>
        </label>

        <p v-if="errorMessage" class="text-destructive text-lg">{{ errorMessage }}</p>
        <p v-if="successMessage" class="text-lg text-emerald-600">{{ successMessage }}</p>

        <button
          type="submit"
          :disabled="submitting"
          class="bg-primary text-primary-foreground inline-flex w-full items-center justify-center rounded-md px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
        >
          <template v-if="submitting">Working…</template>
          <template v-else-if="mode === 'login'">Sign in</template>
          <template v-else-if="mode === 'register'">Create account</template>
          <template v-else>Send reset email</template>
        </button>
      </form>

      <div class="text-muted-foreground space-y-1">
        <template v-if="mode === 'login'">
          <p>
            Need an account?
            <button class="hover:text-foreground underline" @click="setMode('register')">
              Register
            </button>
          </p>
          <p>
            Forgot your password?
            <button class="hover:text-foreground underline" @click="setMode('forgot')">
              Reset it
            </button>
          </p>
        </template>
        <template v-else>
          <p>
            <button class="hover:text-foreground underline" @click="setMode('login')">
              ← Back to sign in
            </button>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
