<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { Eye, EyeOff } from '@lucide/vue';
import { useAuthStore } from '@/stores/auth';
import { useMeStore } from '@/stores/me';
import { gravatarUrl } from '@/lib/gravatar';

const auth = useAuthStore();
const me = useMeStore();
const router = useRouter();

watchEffect(() => {
  if (!auth.isSignedIn) {
    auth.openLogin();
    router.replace({ name: 'home' });
  }
});

const avatarUrl = ref<string | null>(null);
watch(
  () => me.email,
  async (email) => {
    avatarUrl.value = await gravatarUrl(email, 200);
  },
  { immediate: true },
);

// Display name (debounced save)
const displayName = ref('');
const displayNameSaving = ref(false);
const displayNameError = ref<string | null>(null);
let displayNameTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => me.displayName,
  (name) => {
    if (!displayName.value || displayName.value === '') {
      displayName.value = name ?? '';
    }
  },
  { immediate: true },
);

function onDisplayNameInput() {
  if (displayNameTimer) clearTimeout(displayNameTimer);
  displayNameTimer = setTimeout(saveDisplayName, 600);
}

async function saveDisplayName() {
  const next = displayName.value.trim();
  if (next === (me.displayName ?? '')) return;
  displayNameSaving.value = true;
  displayNameError.value = null;
  try {
    await auth.updateDisplayName(next);
  } catch (e) {
    displayNameError.value = e instanceof Error ? e.message : 'Could not save.';
  } finally {
    displayNameSaving.value = false;
  }
}

// Modal state
type ModalKind = 'email' | 'password' | 'delete' | null;
const modal = ref<ModalKind>(null);
const newEmail = ref('');
const newPassword = ref('');
const currentPassword = ref('');
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const submitting = ref(false);
const modalError = ref<string | null>(null);

function openModal(kind: Exclude<ModalKind, null>) {
  modal.value = kind;
  newEmail.value = '';
  newPassword.value = '';
  currentPassword.value = '';
  showCurrentPassword.value = false;
  showNewPassword.value = false;
  submitting.value = false;
  modalError.value = null;
}

function closeModal() {
  modal.value = null;
}

async function submitModal() {
  modalError.value = null;
  submitting.value = true;
  try {
    if (modal.value === 'email') {
      await auth.updateUserEmail(newEmail.value, currentPassword.value);
    } else if (modal.value === 'password') {
      await auth.updateUserPassword(newPassword.value, currentPassword.value);
    } else if (modal.value === 'delete') {
      await auth.deleteAccount(currentPassword.value);
      closeModal();
      router.replace({ name: 'home' });
      return;
    }
    closeModal();
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    submitting.value = false;
  }
}

const submitDisabled = computed(() => {
  if (submitting.value) return true;
  if (!currentPassword.value) return true;
  if (modal.value === 'email' && !newEmail.value) return true;
  if (modal.value === 'password' && !newPassword.value) return true;
  return false;
});
</script>

<template>
  <main v-if="auth.isSignedIn" class="flex-1 max-w-3xl w-full mx-auto p-4 space-y-6">
    <header class="flex items-center gap-4">
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        alt=""
        class="size-20 rounded-full bg-muted object-cover"
      />
      <div v-else class="size-20 rounded-full bg-muted" />
      <div class="text-xs text-muted-foreground">
        Avatar via
        <a href="https://gravatar.com/" target="_blank" rel="noopener" class="underline hover:text-foreground">
          Gravatar
        </a>
      </div>
    </header>

    <section class="space-y-2">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Display name</span>
        <input
          v-model="displayName"
          type="text"
          class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          @input="onDisplayNameInput"
          @blur="saveDisplayName"
        />
      </label>
      <p v-if="displayNameSaving" class="text-xs text-muted-foreground">Saving…</p>
      <p v-if="displayNameError" class="text-xs text-destructive">{{ displayNameError }}</p>
    </section>

    <section class="space-y-2">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Email</span>
        <button
          type="button"
          class="w-full text-left px-3 py-2 rounded-md border bg-background text-sm hover:bg-accent"
          @click="openModal('email')"
        >
          {{ me.email ?? '—' }}
        </button>
      </label>
    </section>

    <section class="space-y-2">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Password</span>
        <button
          type="button"
          class="w-full text-left px-3 py-2 rounded-md border bg-background text-sm hover:bg-accent font-mono"
          @click="openModal('password')"
        >
          ••••••••
        </button>
      </label>
    </section>

    <section class="pt-6 flex justify-center">
      <button
        type="button"
        class="text-sm text-destructive hover:underline"
        @click="openModal('delete')"
      >
        Delete account
      </button>
    </section>

    <!-- Email/Password/Delete modals share the same shell -->
    <div
      v-if="modal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      @click.self="closeModal"
    >
      <div class="relative w-full max-w-sm bg-background border rounded-lg shadow-lg p-6 space-y-4">
        <h2 class="text-lg font-semibold">
          <template v-if="modal === 'email'">Change your email</template>
          <template v-else-if="modal === 'password'">Change your password</template>
          <template v-else>Delete your account</template>
        </h2>

        <p v-if="modal === 'delete'" class="text-sm text-muted-foreground">
          This will permanently delete your account and all associated data.
        </p>

        <form class="space-y-3" @submit.prevent="submitModal">
          <label v-if="modal === 'email'" class="block space-y-1">
            <span class="text-xs text-muted-foreground">New email</span>
            <input
              v-model="newEmail"
              type="email"
              autocomplete="email"
              required
              autofocus
              class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label v-if="modal === 'password'" class="block space-y-1">
            <span class="text-xs text-muted-foreground">New password</span>
            <div class="relative">
              <input
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                autocomplete="new-password"
                required
                class="w-full px-3 py-2 pr-10 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                tabindex="-1"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                @click="showNewPassword = !showNewPassword"
              >
                <component :is="showNewPassword ? EyeOff : Eye" class="size-4" />
              </button>
            </div>
          </label>

          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Current password</span>
            <div class="relative">
              <input
                v-model="currentPassword"
                :type="showCurrentPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                :autofocus="modal !== 'email'"
                class="w-full px-3 py-2 pr-10 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                tabindex="-1"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                @click="showCurrentPassword = !showCurrentPassword"
              >
                <component :is="showCurrentPassword ? EyeOff : Eye" class="size-4" />
              </button>
            </div>
          </label>

          <p v-if="modalError" class="text-sm text-destructive">{{ modalError }}</p>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-3 py-2 rounded-md text-sm hover:bg-accent text-muted-foreground"
              @click="closeModal"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="submitDisabled"
              :class="[
                'px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50',
                modal === 'delete'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-primary text-primary-foreground',
              ]"
            >
              <template v-if="submitting">Working…</template>
              <template v-else-if="modal === 'email'">Change email</template>
              <template v-else-if="modal === 'password'">Change password</template>
              <template v-else>Delete account</template>
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>
