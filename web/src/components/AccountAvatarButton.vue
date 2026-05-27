<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { LogIn, LogOut, Monitor, Moon, Sun, User } from '@lucide/vue'
import Popover from '@/components/Popover.vue'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'

const router = useRouter()
const { theme } = useTheme()
const auth = useAuthStore()
const me = useMeStore()

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'auto', label: 'Auto', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
]

const initial = computed(() => {
  const name = me.displayName ?? me.email ?? ''
  return (name[0] ?? '?').toUpperCase()
})

const avatarUrl = ref<string | null>(null)
watch(
  () => me.email,
  async (email) => {
    avatarUrl.value = await gravatarUrl(email, 56)
  },
  { immediate: true },
)

function handleSignIn(close: () => void) {
  close()
  auth.openLogin()
}

function goProfile(close: () => void) {
  close()
  router.push({ name: 'profile' })
}

async function handleSignOut(close: () => void) {
  close()
  await auth.signOut()
}
</script>

<template>
  <Popover placement="left-start" :offset-px="8" closable>
    <template #trigger="{ triggerRef, toggle, isOpen }">
      <button
        :ref="triggerRef"
        v-tap-feedback
        type="button"
        :class="[
          'floating-nav pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90',
          isOpen ? 'pointer-events-none opacity-0' : '',
        ]"
        :aria-label="auth.isSignedIn ? 'Account menu' : 'Sign in'"
        :aria-expanded="isOpen"
        aria-haspopup="menu"
        @click="toggle"
      >
        <img
          v-if="auth.isSignedIn && avatarUrl"
          :src="avatarUrl"
          :alt="me.displayName ?? me.email ?? ''"
          class="size-10 rounded-full"
        />
        <span
          v-else-if="auth.isSignedIn"
          class="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full font-medium"
        >
          {{ initial }}
        </span>
        <User v-else class="size-5" />
      </button>
    </template>

    <template #default="{ close }">
      <div
        class="w-72 max-w-[calc(100vw-4.5rem)] space-y-1 p-2"
        role="menu"
      >
        <div
          v-if="auth.isSignedIn"
          class="flex w-full items-center gap-2.5 p-2"
        >
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            :alt="me.displayName ?? me.email ?? ''"
            class="size-9 rounded-full"
          />
          <span
            v-else
            class="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full font-medium"
          >
            {{ initial }}
          </span>
          <span class="min-w-0 flex-1">
            <span
              v-if="me.displayName"
              class="block truncate text-base font-medium"
            >
              {{ me.displayName }}
            </span>
            <span
              v-if="me.email"
              :class="[
                'block truncate',
                me.displayName ? 'text-sm opacity-70' : 'text-base font-medium',
              ]"
            >
              {{ me.email }}
            </span>
          </span>
        </div>

        <button
          v-if="auth.isSignedIn"
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
          role="menuitem"
          @click="goProfile(close)"
        >
          <User class="size-5" />
          <span class="flex-1">Profile</span>
        </button>

        <button
          v-else
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
          role="menuitem"
          @click="handleSignIn(close)"
        >
          <LogIn class="size-5" />
          <span class="flex-1">Sign in</span>
        </button>

        <button
          v-if="auth.isSignedIn"
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
          role="menuitem"
          @click="handleSignOut(close)"
        >
          <LogOut class="size-5" />
          <span class="flex-1">Sign out</span>
        </button>

        <div
          class="flex h-12 w-full items-center px-1"
          role="radiogroup"
          aria-label="Theme"
        >
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            v-tap-feedback
            type="button"
            role="radio"
            :aria-checked="theme === opt.value"
            :class="[
              'inline-flex h-10 flex-auto items-center justify-center gap-1.5 rounded-full px-3 font-sans text-sm font-medium transition-colors',
              theme === opt.value
                ? 'bg-card-foreground/15'
                : 'opacity-70 hover:opacity-100',
            ]"
            @click="theme = opt.value"
          >
            <component :is="opt.icon" class="size-4" />
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>
