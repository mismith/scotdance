<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, EyeOff, LogOut, Pencil } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'
import Dialog from '@/components/Dialog.vue'

const auth = useAuthStore()
const me = useMeStore()
const router = useRouter()

watchEffect(() => {
  if (!auth.isSignedIn) {
    auth.openLogin()
    router.replace({ name: 'home' })
  }
})

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
    modalError.value = e instanceof Error ? e.message : 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}

const submitDisabled = computed(() => {
  if (submitting.value) return true
  if (!currentPassword.value) return true
  if (modal.value === 'email' && !newEmail.value) return true
  if (modal.value === 'password' && !newPassword.value) return true
  return false
})
</script>

<template>
  <div v-if="auth.isSignedIn" class="flex flex-1 flex-col">
    <header
      class="bg-background sticky top-0 z-20 mx-auto flex w-full max-w-3xl items-end justify-between gap-3 p-4 pb-3"
    >
      <div class="min-w-0 flex-1">
        <div
          class="text-foreground/65 text-xs text-eyebrow"
        >
          Account
        </div>
        <h1 class="text-4xl leading-[1.04] font-medium tracking-tight">
          Profile
        </h1>
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 pt-0">
      <section class="flex items-center gap-4">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          alt=""
          class="bg-muted size-20 rounded-full object-cover"
        />
        <div v-else class="bg-muted size-20 rounded-full" />
        <div class="text-muted-foreground">
          Avatar via
          <a
            href="https://gravatar.com/"
            target="_blank"
            rel="noopener"
            class="hover:text-foreground underline"
          >
            Gravatar
          </a>
        </div>
      </section>

      <section class="space-y-2">
        <label class="block space-y-1">
          <span class="text-muted-foreground">Display name</span>
          <input
            v-model="displayName"
            type="text"
            class="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            @input="onDisplayNameInput"
            @blur="saveDisplayName"
          />
        </label>
        <p v-if="displayNameSaving" class="text-muted-foreground">Saving…</p>
        <p v-if="displayNameError" class="text-destructive">
          {{ displayNameError }}
        </p>
      </section>

      <section class="space-y-2">
        <label class="block space-y-1">
          <span class="text-muted-foreground">Email</span>
          <button
            type="button"
            class="bg-background hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left"
            @click="openModal('email')"
          >
            <span class="truncate">{{ me.email ?? '—' }}</span>
            <Pencil class="text-muted-foreground size-3.5 shrink-0" />
          </button>
        </label>
      </section>

      <section class="space-y-2">
        <label class="block space-y-1">
          <span class="text-muted-foreground">Password</span>
          <button
            type="button"
            class="bg-background hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left"
            @click="openModal('password')"
          >
            <span class="font-mono">••••••••</span>
            <Pencil class="text-muted-foreground size-3.5 shrink-0" />
          </button>
        </label>
      </section>

      <section class="flex flex-col items-center gap-3 pt-6">
        <button
          type="button"
          class="hover:bg-accent inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
          @click="handleSignOut"
        >
          <LogOut class="size-3.5" />
          Sign out
        </button>
        <button
          type="button"
          class="text-destructive text-sm hover:underline"
          @click="openModal('delete')"
        >
          Delete account
        </button>
      </section>

    </main>

    <Dialog :open="!!modal" @close="closeModal">
      <h2 class="text-3xl font-medium tracking-tight">
        <template v-if="modal === 'email'">Change your email</template>
        <template v-else-if="modal === 'password'">Change your password</template>
        <template v-else>Delete your account</template>
      </h2>

      <p v-if="modal === 'delete'" class="text-muted-foreground text-lg">
        This will permanently delete your account and all associated data.
      </p>

      <form class="space-y-3" @submit.prevent="submitModal">
        <label v-if="modal === 'email'" class="block space-y-1">
          <span class="text-muted-foreground">New email</span>
          <input
            v-model="newEmail"
            type="email"
            autocomplete="email"
            required
            autofocus
            class="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
          />
        </label>

        <label v-if="modal === 'password'" class="block space-y-1">
          <span class="text-muted-foreground">New password</span>
          <div class="relative">
            <input
              v-model="newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              autocomplete="new-password"
              required
              class="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 pr-10 focus:ring-2 focus:outline-none"
            />
            <button
              type="button"
              tabindex="-1"
              class="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1"
              @click="showNewPassword = !showNewPassword"
            >
              <component :is="showNewPassword ? EyeOff : Eye" class="size-4" />
            </button>
          </div>
        </label>

        <label class="block space-y-1">
          <span class="text-muted-foreground">Current password</span>
          <div class="relative">
            <input
              v-model="currentPassword"
              :type="showCurrentPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              :autofocus="modal !== 'email'"
              class="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 pr-10 focus:ring-2 focus:outline-none"
            />
            <button
              type="button"
              tabindex="-1"
              class="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1"
              @click="showCurrentPassword = !showCurrentPassword"
            >
              <component :is="showCurrentPassword ? EyeOff : Eye" class="size-4" />
            </button>
          </div>
        </label>

        <p v-if="modalError" class="text-destructive text-lg">{{ modalError }}</p>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="hover:bg-accent text-muted-foreground rounded-md px-3 py-1.5 text-sm"
            @click="closeModal"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="submitDisabled"
            :class="[
              'rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50',
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
    </Dialog>
  </div>
</template>
