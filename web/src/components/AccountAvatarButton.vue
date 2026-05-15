<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { LogIn, LogOut, Monitor, Moon, Sun, User, X } from '@lucide/vue'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'

const router = useRouter()
const { theme } = useTheme()
const auth = useAuthStore()
const me = useMeStore()

const open = ref(false)
onKeyStroke('Escape', () => (open.value = false))

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
  <div class="relative">
    <!-- Avatar trigger. Fades to opacity-0 when open (staying in flow) so
         the X cancel button can take its place (same size/position) like
         the ExpandingPill compact-pill pattern. -->
    <button
      type="button"
      :class="[
        'floating-nav pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90',
        open ? 'pointer-events-none opacity-0' : '',
      ]"
      :aria-label="auth.isSignedIn ? 'Account menu' : 'Sign in'"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = true"
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

    <!-- Backdrop: outside-click absorber so taps below the menu don't
         activate page content. -->
    <Transition
      enter-active-class="transition ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40"
        aria-hidden="true"
        @click="open = false"
      />
    </Transition>

    <!-- Menu overlay: morphs out of the avatar position (top-right corner
         of the overlay box) via clip-path. -->
    <Transition
      enter-active-class="transition-[clip-path,opacity] ease-out"
      enter-from-class="opacity-0 [clip-path:inset(0_0_calc(100%-3rem)_calc(100%-3rem)_round_1.5rem)]"
      enter-to-class="opacity-100 [clip-path:inset(0_0_0_0_round_1.5rem)]"
      leave-active-class="transition-[clip-path,opacity] ease-out"
      leave-from-class="opacity-100 [clip-path:inset(0_0_0_0_round_1.5rem)]"
      leave-to-class="opacity-0 [clip-path:inset(0_0_calc(100%-3rem)_calc(100%-3rem)_round_1.5rem)]"
    >
      <div
        v-if="open"
        class="absolute top-0 right-14 z-50 w-72 max-w-[calc(100vw-4.5rem)]"
        role="menu"
      >
        <div
          class="floating-nav min-h-12 w-full space-y-1 overflow-hidden rounded-3xl p-2"
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
                  me.displayName
                    ? 'text-sm opacity-70'
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
            class="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
            role="menuitem"
            @click="goProfile"
          >
            <User class="size-5" />
            <span class="flex-1">Profile</span>
          </button>

          <button
            v-else
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
            role="menuitem"
            @click="handleSignIn"
          >
            <LogIn class="size-5" />
            <span class="flex-1">Sign in</span>
          </button>

          <button
            v-if="auth.isSignedIn"
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
            role="menuitem"
            @click="handleSignOut"
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
      </div>
    </Transition>

    <!-- X cancel button: covers the avatar position when open. -->
    <Transition
      enter-active-class="transition-all delay-75 ease-rubber-band"
      enter-from-class="scale-50 opacity-0"
      leave-active-class="transition-all ease-out"
      leave-to-class="scale-50 opacity-0"
    >
      <button
        v-if="open"
        type="button"
        class="floating-nav pointer-events-auto absolute top-0 right-0 z-60 flex size-12 items-center justify-center rounded-full hover:opacity-90"
        aria-label="Close"
        @click="open = false"
      >
        <X class="size-5" />
      </button>
    </Transition>
  </div>
</template>
