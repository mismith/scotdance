<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
import type { AccountSettings } from './settings'
import { useMorph } from '@/lib/morph'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Avatar from '@/components/Avatar.vue'
const props = defineProps<{ account: AccountSettings }>()
const auth = props.account
const emit = defineEmits<{ changed: []; deleted: [] }>()
// Display name (debounced save)
const displayName = ref('')
const displayNameSaving = ref(false)
const displayNameError = ref<string | null>(null)
let displayNameTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => auth.displayName,
  (name) => {
    if (!displayName.value || displayName.value === '') {
      displayName.value = name ?? ''
    }
  },
  { immediate: true },
)

function onDisplayNameInput() {
  if (displayNameTimer) clearTimeout(displayNameTimer)
  displayNameTimer = setTimeout(saveDisplayName, 600)
}

async function saveDisplayName() {
  if (displayNameSaving.value) return
  const next = displayName.value.trim()
  if (next === (auth.displayName ?? '')) return
  displayNameSaving.value = true
  displayNameError.value = null
  let saved = false
  try {
    await auth.updateDisplayName(next)
    saved = true
  } catch (e) {
    displayNameError.value = e instanceof Error ? e.message : 'Could not save.'
  } finally {
    displayNameSaving.value = false
  }
  // Keep the final keystrokes if another edit arrived while the request was saving.
  if (saved) {
    if (displayName.value.trim() !== next) void saveDisplayName()
    else emit('changed')
  }
}

// Modal state
type ModalKind = 'email' | 'password' | 'delete' | null
const modal = ref<ModalKind>(null)
// The sheet grows out of the row that opened it (lib/morph).
const sheet = useMorph()
const newEmail = ref('')
const newPassword = ref('')
const currentPassword = ref('')
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const submitting = ref(false)
const modalError = ref<string | null>(null)
// An account without a password (made with Apple or Google in the v4 beta)
// confirms it's them by setting one: offer the link.
const needsPassword = computed(() => !auth.hasPassword)
const passwordLinkSent = ref(false)
async function sendPasswordLink() {
  if (!auth.user?.email) return
  modalError.value = null
  try {
    await auth.resetPassword(auth.user?.email)
    passwordLinkSent.value = true
  } catch {
    modalError.value = 'That didn’t work. Check your connection and try again.'
  }
}

function openModal(kind: Exclude<ModalKind, null>) {
  modal.value = kind
  newEmail.value = ''
  newPassword.value = ''
  currentPassword.value = ''
  showCurrentPassword.value = false
  showNewPassword.value = false
  submitting.value = false
  modalError.value = null
  passwordLinkSent.value = false
  sheet.show()
}

function closeModal() {
  sheet.hide().then(() => (modal.value = null))
}

async function submitModal() {
  modalError.value = null
  submitting.value = true
  try {
    if (modal.value === 'email') {
      await auth.updateUserEmail(newEmail.value, currentPassword.value)
    } else if (modal.value === 'password') {
      await auth.updateUserPassword(newPassword.value, currentPassword.value)
    } else if (modal.value === 'delete') {
      await auth.deleteAccount(currentPassword.value)
      closeModal()
      emit('deleted')
      return
    }
    closeModal()
    emit('changed')
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    modalError.value =
      code === 'auth/invalid-credential' || code === 'auth/wrong-password'
        ? 'That password isn’t right. Check it and try again.'
        : code === 'auth/requires-recent-login'
          ? needsPassword.value
            ? 'For your security, set a password with the link above, sign in with it, then try again.'
            : 'For your security, sign out, sign back in, then try again.'
          : code === 'auth/email-already-in-use'
            ? 'That email already has an account.'
            : 'That didn’t work. Check your connection and try again.'
  } finally {
    submitting.value = false
  }
}

const submitDisabled = computed(() => {
  if (submitting.value) return true
  if (auth.hasPassword && !currentPassword.value) return true
  if (modal.value === 'email' && !newEmail.value) return true
  if (modal.value === 'password' && !newPassword.value) return true
  return false
})

onScopeDispose(() => { if (displayNameTimer) clearTimeout(displayNameTimer) })
</script>
<template>
  <div class="space-y-5 px-4 py-3">
      <header class="space-y-2">
        <h1 class="sr-only">Account</h1>
        <div class="flex items-end gap-4">
          <Avatar :name="displayName || auth.user?.email || '?'" :email="auth.user?.email" :image="auth.photoURL" size="lg" you />
        <label class="block min-w-0 flex-1 space-y-1.5">
          <span class="flex items-center justify-between gap-2 text-callout font-medium">Your name<span v-if="displayNameSaving" role="status" class="text-sm font-normal text-muted-foreground">Saving…</span></span>
          <input
            v-model="displayName"
            type="text"
            autocomplete="name"
            class="field h-12 w-full rounded-xl px-3 text-base"
            @input="onDisplayNameInput"
            @blur="saveDisplayName"
          />
        </label>
        </div>
        <p class="text-sm text-muted-foreground">Your picture comes from <a href="https://gravatar.com/" target="_blank" rel="noopener" class="font-semibold text-primary">Gravatar</a>.</p>
        <p v-if="displayNameError" class="text-destructive text-sm font-medium" role="alert">Your name didn’t save. Try again.</p>
      </header>

      <ul class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
        <li>
          <div class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
            <span class="min-w-0 flex-1">
              <span class="block text-base font-medium">Email</span>
              <span class="text-muted-foreground block truncate text-sm">{{ auth.user?.email ?? '—' }}</span>
            </span>
            <button type="button" aria-label="Change email" class="text-primary text-callout press-row focus-inset min-h-11 rounded-full px-3 font-semibold" @click="openModal('email')">Change</button>
          </div>
        </li>
        <li v-if="auth.hasPassword">
          <div class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
            <span class="flex-1 text-base font-medium">Password</span>
            <button type="button" aria-label="Change password" class="text-primary text-callout press-row focus-inset min-h-11 rounded-full px-3 font-semibold" @click="openModal('password')">Change</button>
          </div>
        </li>
      </ul>
      <button type="button" class="text-destructive press-row h-12 w-full rounded-full text-callout font-semibold" @click="openModal('delete')">Delete account</button>
    <Dialog :open="sheet.open" :morph="sheet" variant="sheet" @close="closeModal">
      <template #header>
        <h2 class="text-title">
          <template v-if="modal === 'email'">Change your email</template>
          <template v-else-if="modal === 'password'">Change your password</template>
          <template v-else>Delete your account?</template>
        </h2>
      </template>
      <form class="space-y-3 p-4 pb-[calc(1.5rem+var(--safe-bottom))]" @submit.prevent="submitModal">
        <p v-if="modal === 'delete'" class="text-base">
          This removes your account, your favourites and your settings. It can’t be undone. Competition results
          aren’t affected. It also removes your private dancer profiles and signs you out of linked ScotDance apps. Submitted entries and payments are handled separately.
        </p>

        <label v-if="modal === 'email'" class="block space-y-1.5">
          <span class="text-callout font-medium">New email</span>
          <input v-model="newEmail" type="email" autocomplete="email" required class="field h-12 w-full rounded-xl px-3 text-base" />
        </label>

        <label v-if="modal === 'password'" class="block space-y-1.5">
          <span class="text-callout font-medium">New password</span>
          <span class="relative block">
            <input v-model="newPassword" :type="showNewPassword ? 'text' : 'password'" autocomplete="new-password" required class="field h-12 w-full rounded-xl pr-24 pl-3 text-base" />
            <button type="button" class="text-primary press absolute top-1/2 right-1 flex h-10 -translate-y-1/2 items-center gap-1 rounded-full px-3 text-sm font-semibold" @click="showNewPassword = !showNewPassword">
              <component :is="showNewPassword ? EyeOff : Eye" class="size-4" /> {{ showNewPassword ? 'Hide' : 'Show' }}
            </button>
          </span>
        </label>

        <div v-if="auth.hasPassword">
          <label class="block space-y-1.5">
            <span class="text-callout font-medium">Your current password</span>
            <span class="relative block">
              <input v-model="currentPassword" :type="showCurrentPassword ? 'text' : 'password'" autocomplete="current-password" required class="field h-12 w-full rounded-xl pr-24 pl-3 text-base" />
              <button type="button" class="text-primary press absolute top-1/2 right-1 flex h-10 -translate-y-1/2 items-center gap-1 rounded-full px-3 text-sm font-semibold" @click="showCurrentPassword = !showCurrentPassword">
                <component :is="showCurrentPassword ? EyeOff : Eye" class="size-4" /> {{ showCurrentPassword ? 'Hide' : 'Show' }}
              </button>
            </span>
          </label>
          <!-- Accounts made with an emailed link can look like they have a password. -->
          <button type="button" class="text-primary press h-11 text-sm font-semibold" @click="sendPasswordLink">
            Forgot it, or never had one? Email me a link
          </button>
          <p v-if="passwordLinkSent" class="text-done-foreground text-sm font-medium" role="status">
            A link to set a password is on its way to {{ auth.user?.email }}.
          </p>
        </div>
        <div v-else class="space-y-1">
          <p class="text-muted-foreground text-sm">
            To confirm it’s you, your account needs a password. Get a link to set one, sign in with it, then come back
            here.
          </p>
          <button type="button" class="text-primary press h-11 font-semibold" @click="sendPasswordLink">Email me a link</button>
          <p v-if="passwordLinkSent" class="text-done-foreground text-sm font-medium" role="status">
            A link is on its way to {{ auth.user?.email }}.
          </p>
        </div>

        <p v-if="modalError" class="text-destructive text-callout font-medium" role="alert">{{ modalError }}</p>

        <Button
          type="submit"
          size="lg"
          block
          :variant="modal === 'delete' ? 'destructive' : 'primary'"
          :disabled="submitDisabled && !submitting"
          :busy="submitting"
        >
          <template v-if="modal === 'email'">Change email</template>
          <template v-else-if="modal === 'password'">Change password</template>
          <template v-else>Delete my account</template>
        </Button>
        <Button variant="plain" size="lg" block @click="closeModal">Cancel</Button>
      </form>
    </Dialog>
  </div>
</template>
