<script setup lang="ts">
import { ref, watch } from 'vue';
import { Eye, EyeOff, X } from '@lucide/vue';
import { useAuthStore } from '@/stores/auth';

type Mode = 'login' | 'register' | 'forgot';

const auth = useAuthStore();
const mode = ref<Mode>('login');
const email = ref('');
const password = ref('');
const passwordVisible = ref(false);
const submitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

watch(
  () => auth.loginDialogOpen,
  (open) => {
    if (open) {
      mode.value = 'login';
      errorMessage.value = null;
      successMessage.value = null;
      passwordVisible.value = false;
    }
  },
);

watch(
  () => auth.isSignedIn,
  (signedIn) => {
    if (signedIn && auth.loginDialogOpen) {
      auth.closeLogin();
      email.value = '';
      password.value = '';
    }
  },
);

function setMode(next: Mode) {
  mode.value = next;
  errorMessage.value = null;
  successMessage.value = null;
}

async function submit() {
  errorMessage.value = null;
  successMessage.value = null;
  submitting.value = true;
  try {
    if (mode.value === 'login') {
      await auth.signInWithEmail(email.value, password.value);
    } else if (mode.value === 'register') {
      await auth.registerWithEmail(email.value, password.value);
    } else {
      await auth.resetPassword(email.value);
      successMessage.value = 'Check your email inbox for instructions to reset your password.';
    }
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    v-if="auth.loginDialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    role="dialog"
    aria-modal="true"
    @click.self="auth.closeLogin()"
  >
    <div class="relative w-full max-w-sm bg-background border rounded-lg shadow-lg p-6 space-y-4">
      <button
        type="button"
        class="absolute top-2 right-2 p-1 rounded-md hover:bg-accent text-muted-foreground"
        title="Close"
        @click="auth.closeLogin()"
      >
        <X class="size-4" />
      </button>

      <h2 class="text-lg font-semibold">
        <template v-if="mode === 'login'">Sign in</template>
        <template v-else-if="mode === 'register'">Create account</template>
        <template v-else>Reset password</template>
      </h2>

      <form class="space-y-3" @submit.prevent="submit">
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Email</span>
          <input
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            autofocus
            class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label v-if="mode !== 'forgot'" class="block space-y-1">
          <span class="text-xs text-muted-foreground">Password</span>
          <div class="relative">
            <input
              v-model="password"
              :type="passwordVisible ? 'text' : 'password'"
              name="password"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              required
              class="w-full px-3 py-2 pr-10 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              tabindex="-1"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              @click="passwordVisible = !passwordVisible"
            >
              <component :is="passwordVisible ? EyeOff : Eye" class="size-4" />
            </button>
          </div>
        </label>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
        <p v-if="successMessage" class="text-sm text-emerald-600">{{ successMessage }}</p>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          <template v-if="submitting">Working…</template>
          <template v-else-if="mode === 'login'">Sign in</template>
          <template v-else-if="mode === 'register'">Create account</template>
          <template v-else>Send reset email</template>
        </button>
      </form>

      <div class="text-xs text-muted-foreground space-y-1">
        <template v-if="mode === 'login'">
          <p>
            Need an account?
            <button class="underline hover:text-foreground" @click="setMode('register')">Register</button>
          </p>
          <p>
            Forgot your password?
            <button class="underline hover:text-foreground" @click="setMode('forgot')">Reset it</button>
          </p>
        </template>
        <template v-else>
          <p>
            <button class="underline hover:text-foreground" @click="setMode('login')">← Back to sign in</button>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
