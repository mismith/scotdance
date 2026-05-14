<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { LogIn, LogOut, Monitor, Moon, Sun, User } from '@lucide/vue'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'

const router = useRouter()
const { theme } = useTheme()
const auth = useAuthStore()
const me = useMeStore()

const open = ref(false)
const rootRef = useTemplateRef<HTMLElement>('root')
onClickOutside(rootRef, () => (open.value = false))
onKeyStroke('Escape', () => (open.value = false))

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'auto', label: 'System', icon: Monitor },
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

function handleSignIn() {
  open.value = false
  auth.openLogin()
}

function goProfile() {
  open.value = false
  router.push({ name: 'profile' })
}

async function handleSignOut() {
  open.value = false
  await auth.signOut()
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="bg-nav/90 text-nav-foreground flex size-12 shrink-0 items-center justify-center rounded-full shadow-lg backdrop-blur-xl transition-opacity hover:opacity-90"
      :aria-label="auth.isSignedIn ? 'Account menu' : 'Sign in'"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
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

    <Transition
      enter-active-class="transition ease-[cubic-bezier(0.34,1.3,0.64,1)]"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border p-3 font-sans shadow-lg"
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
            class="bg-muted size-9 rounded-full"
          />
          <span
            v-else
            class="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full font-medium"
          >
            {{ initial }}
          </span>
          <span class="min-w-0 flex-1">
            <span v-if="me.displayName" class="block truncate text-base font-medium">
              {{ me.displayName }}
            </span>
            <span
              v-if="me.email"
              :class="[
                'block truncate',
                me.displayName
                  ? 'text-muted-foreground text-sm'
                  : 'text-base font-medium',
              ]"
            >
              {{ me.email }}
            </span>
          </span>
        </div>

        <button
          v-if="auth.isSignedIn"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
          role="menuitem"
          @click="goProfile"
        >
          <User class="size-5" />
          <span class="flex-1">Profile</span>
        </button>

        <button
          v-else
          type="button"
          class="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
          role="menuitem"
          @click="handleSignIn"
        >
          <LogIn class="size-5" />
          <span class="flex-1">Sign in</span>
        </button>

        <button
          v-if="auth.isSignedIn"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
          role="menuitem"
          @click="handleSignOut"
        >
          <LogOut class="size-5" />
          <span class="flex-1">Sign out</span>
        </button>

        <div class="border-border my-2 border-t" />

        <div
          class="bg-chip grid grid-cols-3 gap-1 rounded-lg p-1"
          role="radiogroup"
          aria-label="Theme"
        >
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="theme === opt.value"
            :class="[
              'flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors',
              theme === opt.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="theme = opt.value"
          >
            <component :is="opt.icon" class="size-4" />
            <span class="text-sm">{{ opt.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
