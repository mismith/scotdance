<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, Eye, EyeOff, LogOut } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'
import Dialog from '@/components/Dialog.vue'
import AppBar from '@/components/nav/AppBar.vue'
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
const newEmail = ref('')
const newPassword = ref('')
const currentPassword = ref('')
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const submitting = ref(false)
const modalError = ref<string | null>(null)

function openModal(kind: Exclude<ModalKind, null>) {
  modal.value = kind
  newEmail.value = ''
  newPassword.value = ''
  currentPassword.value = ''
  showCurrentPassword.value = false
  showNewPassword.value = false
  submitting.value = false
  modalError.value = null
}

function closeModal() {
  modal.value = null
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
          ? 'For your security, sign out, sign back in, then try again.'
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
    <AppBar title="Account" :fallback="{ to: { name: 'more' }, label: 'More' }" />

    <main class="mx-auto w-full max-w-3xl space-y-5 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header class="flex items-center gap-4">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" class="bg-muted size-16 rounded-full object-cover" />
        <div v-else class="bg-muted size-16 rounded-full" />
        <div class="min-w-0">
          <h1 class="text-display truncate">{{ displayName || 'Your account' }}</h1>
          <p class="text-muted-foreground text-sm">Signed in with {{ auth.signInMethod }}</p>
        </div>
      </header>

      <section class="bg-card space-y-2 rounded-2xl border p-4 shadow-sm">
        <label class="block space-y-1.5">
          <span class="text-[0.9375rem] font-bold">Your name</span>
          <input
            v-model="displayName"
            type="text"
            autocomplete="name"
            class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 px-3 text-base outline-none"
            @input="onDisplayNameInput"
            @blur="saveDisplayName"
          />
        </label>
        <p v-if="displayNameSaving" class="text-muted-foreground text-sm">Saving…</p>
        <p v-if="displayNameError" class="text-destructive text-sm font-semibold">Your name didn’t save. Try again.</p>
        <p class="text-muted-foreground text-sm">
          Your picture comes from <a href="https://gravatar.com/" target="_blank" rel="noopener" class="text-primary font-bold">Gravatar</a>.
        </p>
      </section>

      <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
        <li>
          <button type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" @click="openModal('email')">
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">Email</span>
              <span class="text-muted-foreground block truncate text-sm">{{ me.email ?? '—' }}</span>
            </span>
            <span class="text-primary text-[0.9375rem] font-bold">Change</span>
          </button>
        </li>
        <li v-if="auth.hasPassword">
          <button type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" @click="openModal('password')">
            <span class="flex-1 text-base font-bold">Password</span>
            <span class="text-primary text-[0.9375rem] font-bold">Change</span>
          </button>
        </li>
        <li>
          <button type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" @click="roles.open()">
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">How you use ScotDance</span>
              <span class="text-muted-foreground block truncate text-sm">{{ rolesLabel }}</span>
            </span>
            <ChevronRight class="text-muted-foreground size-5" />
          </button>
        </li>
      </ul>

      <div class="space-y-2">
        <button type="button" class="bg-card border-strong flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-base font-bold" @click="handleSignOut">
          <LogOut class="size-5" /> Sign out
        </button>
        <button type="button" class="text-destructive h-12 w-full text-[0.9375rem] font-bold" @click="openModal('delete')">
          Delete account
        </button>
      </div>
    </main>

    <Dialog :open="!!modal" variant="sheet" @close="closeModal">
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
          <span class="text-[0.9375rem] font-bold">New email</span>
          <input v-model="newEmail" type="email" autocomplete="email" required class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 px-3 text-base outline-none" />
        </label>

        <label v-if="modal === 'password'" class="block space-y-1.5">
          <span class="text-[0.9375rem] font-bold">New password</span>
          <span class="relative block">
            <input v-model="newPassword" :type="showNewPassword ? 'text' : 'password'" autocomplete="new-password" required class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 pr-24 pl-3 text-base outline-none" />
            <button type="button" class="text-primary absolute top-1/2 right-1 flex h-10 -translate-y-1/2 items-center gap-1 rounded-lg px-2 text-sm font-bold" @click="showNewPassword = !showNewPassword">
              <component :is="showNewPassword ? EyeOff : Eye" class="size-4" /> {{ showNewPassword ? 'Hide' : 'Show' }}
            </button>
          </span>
        </label>

        <label v-if="auth.hasPassword" class="block space-y-1.5">
          <span class="text-[0.9375rem] font-bold">Your current password</span>
          <span class="relative block">
            <input v-model="currentPassword" :type="showCurrentPassword ? 'text' : 'password'" autocomplete="current-password" required class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 pr-24 pl-3 text-base outline-none" />
            <button type="button" class="text-primary absolute top-1/2 right-1 flex h-10 -translate-y-1/2 items-center gap-1 rounded-lg px-2 text-sm font-bold" @click="showCurrentPassword = !showCurrentPassword">
              <component :is="showCurrentPassword ? EyeOff : Eye" class="size-4" /> {{ showCurrentPassword ? 'Hide' : 'Show' }}
            </button>
          </span>
        </label>
        <p v-else class="text-muted-foreground text-sm">You may be asked to sign in with {{ auth.signInMethod }} again to confirm.</p>

        <p v-if="modalError" class="text-destructive text-[0.9375rem] font-semibold" role="alert">{{ modalError }}</p>

        <button
          type="submit"
          :disabled="submitDisabled"
          :class="[
            'h-12 w-full rounded-xl text-base font-bold disabled:opacity-50',
            modal === 'delete' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground',
          ]"
        >
          <template v-if="submitting">Working…</template>
          <template v-else-if="modal === 'email'">Change email</template>
          <template v-else-if="modal === 'password'">Change password</template>
          <template v-else>Delete my account</template>
        </button>
        <button type="button" class="text-muted-foreground h-11 w-full font-bold" @click="closeModal">Cancel</button>
      </form>
    </Dialog>
  </div>
</template>
