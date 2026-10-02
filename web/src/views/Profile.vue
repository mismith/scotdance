<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, Eye, EyeOff, LogOut } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import { ROLES, useRoles } from '@/composables/useRoles'

const auth = useAuthStore()
const me = useMeStore()
const router = useRouter()
const roles = useRoles()
const rolesLabel = computed(() => ROLES.filter((r) => roles.has(r.id)).map((r) => r.label).join(', ') || 'Not answered yet')

const avatarUrl = ref<string | null>(null)
watch(
  () => me.email,
  async (email) => {
    avatarUrl.value = await gravatarUrl(email, 200)
  },
  { immediate: true },
)

// Display name (debounced save)
const displayName = ref('')
const displayNameSaving = ref(false)
const displayNameError = ref<string | null>(null)
let displayNameTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => me.displayName,
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
  const next = displayName.value.trim()
  if (next === (me.displayName ?? '')) return
  displayNameSaving.value = true
  displayNameError.value = null
  try {
    await auth.updateDisplayName(next)
  } catch (e) {
    displayNameError.value = e instanceof Error ? e.message : 'Could not save.'
  } finally {
    displayNameSaving.value = false
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
  if (!me.email) return
  modalError.value = null
  try {
    await auth.resetPassword(me.email)
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

async function handleSignOut() {
  await auth.signOut()
  router.replace({ name: 'home' })
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
      router.replace({ name: 'home' })
      return
    }
    closeModal()
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
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="Account" :fallback="{ to: { name: 'settings' }, label: 'Settings' }" />

    <main class="mx-auto w-full max-w-3xl space-y-5 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header class="flex items-center gap-4">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" class="bg-muted size-16 rounded-full object-cover" />
        <div v-else class="bg-muted size-16 rounded-full" />
        <div class="min-w-0">
          <h1 class="text-display truncate">{{ displayName || 'Your account' }}</h1>
        </div>
      </header>

      <section class="surface space-y-2 rounded-2xl p-4">
        <label class="block space-y-1.5">
          <span class="text-callout font-medium">Your name</span>
          <input
            v-model="displayName"
            type="text"
            autocomplete="name"
            class="field h-12 w-full rounded-xl px-3 text-base"
            @input="onDisplayNameInput"
            @blur="saveDisplayName"
          />
        </label>
        <p v-if="displayNameSaving" class="text-muted-foreground text-sm">Saving…</p>
        <p v-if="displayNameError" class="text-destructive text-sm font-medium" role="alert">Your name didn’t save. Try again.</p>
        <p class="text-muted-foreground text-sm">
          Your picture comes from <a href="https://gravatar.com/" target="_blank" rel="noopener" class="text-primary font-semibold">Gravatar</a>.
        </p>
      </section>

      <ul class="surface rows-inset overflow-hidden rounded-2xl">
        <li>
          <button type="button" class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left" @click="openModal('email')">
            <span class="min-w-0 flex-1">
              <span class="block text-base font-medium">Email</span>
              <span class="text-muted-foreground block truncate text-sm">{{ me.email ?? '—' }}</span>
            </span>
            <span class="text-primary text-callout font-semibold">Change</span>
          </button>
        </li>
        <li v-if="auth.hasPassword">
          <button type="button" class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left" @click="openModal('password')">
            <span class="flex-1 text-base font-medium">Password</span>
            <span class="text-primary text-callout font-semibold">Change</span>
          </button>
        </li>
        <li>
          <button type="button" class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left" @click="roles.open()">
            <span class="min-w-0 flex-1">
              <span class="block text-base font-medium">How you use ScotDance</span>
              <span class="text-muted-foreground block truncate text-sm">{{ rolesLabel }}</span>
            </span>
            <ChevronRight class="text-muted-foreground/70 size-5 shrink-0" />
          </button>
        </li>
      </ul>

      <div class="space-y-2">
        <Button size="lg" block @click="handleSignOut"><LogOut /> Sign out</Button>
        <button type="button" class="text-destructive press-row h-12 w-full rounded-full text-callout font-semibold" @click="openModal('delete')">
          Delete account
        </button>
      </div>
    </main>

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
          This removes your account, the dancers you follow and your settings. It can’t be undone. Competition results
          aren’t affected.
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
            A link to set a password is on its way to {{ me.email }}.
          </p>
        </div>
        <div v-else class="space-y-1">
          <p class="text-muted-foreground text-sm">
            To confirm it’s you, your account needs a password. Get a link to set one, sign in with it, then come back
            here.
          </p>
          <button type="button" class="text-primary press h-11 font-semibold" @click="sendPasswordLink">Email me a link</button>
          <p v-if="passwordLinkSent" class="text-done-foreground text-sm font-medium" role="status">
            A link is on its way to {{ me.email }}.
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
