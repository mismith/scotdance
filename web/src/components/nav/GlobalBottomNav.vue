<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowDownToLine,
  CalendarDays,
  ChevronRight,
  Home,
  LogIn,
  Monitor,
  Moon,
  MoreHorizontal,
  Search,
  Sun,
  Users,
} from '@lucide/vue'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useUpdate } from '@/composables/useUpdate'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'

const route = useRoute()
const router = useRouter()
const update = useUpdate()
const { theme } = useTheme()
const auth = useAuthStore()
const me = useMeStore()

const moreOpen = ref(false)
const moreRef = ref<HTMLElement | null>(null)
onClickOutside(moreRef, () => (moreOpen.value = false))
onKeyStroke('Escape', () => (moreOpen.value = false))

const tabs = [
  {
    name: 'Competitions',
    to: { name: 'competitions' },
    icon: CalendarDays,
    isActive: () => route.path.startsWith('/competitions'),
  },
  {
    name: 'Dancers',
    to: { name: 'dancers' },
    icon: Users,
    isActive: () => route.path.startsWith('/dancers'),
  },
]

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
  moreOpen.value = false
  auth.openLogin()
}

function goProfile() {
  moreOpen.value = false
  router.push({ name: 'profile' })
}
</script>

<template>
  <nav class="bottom-safe pointer-events-none fixed inset-x-0 z-30 px-3">
    <div class="mx-auto flex max-w-3xl items-center justify-between">
      <div
        class="bg-nav/90 text-nav-foreground pointer-events-auto rounded-full p-1 shadow-lg backdrop-blur-xl [view-transition-class:clip] [view-transition-name:nav-left]"
      >
        <div class="flex items-center [view-transition-name:match-element]">
          <RouterLink
            v-for="tab in tabs"
            :key="tab.name"
            :to="tab.to"
            :class="[
              'relative isolate flex h-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full px-4 font-medium transition-colors',
              tab.isActive()
                ? `before:bg-nav-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:content-[''] before:[view-transition-name:nav-left-active]`
                : 'opacity-70 hover:opacity-100',
            ]"
          >
            <component :is="tab.icon" class="size-5" />
            <span class="text-xs leading-none">{{ tab.name }}</span>
          </RouterLink>

          <div ref="moreRef" class="relative">
            <button
              type="button"
              :class="[
                'relative isolate flex h-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full px-4 font-medium transition-colors',
                moreOpen
                  ? `before:bg-nav-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:content-[''] before:[view-transition-name:nav-left-active]`
                  : 'opacity-70 hover:opacity-100',
              ]"
              :aria-expanded="moreOpen"
              aria-haspopup="menu"
              @click="moreOpen = !moreOpen"
            >
              <MoreHorizontal class="size-5" />
              <span class="text-xs leading-none">More</span>
              <span
                v-if="update.updateAvailable && !moreOpen"
                class="bg-secondary absolute top-1 right-1 size-2 animate-pulse rounded-full"
                aria-hidden="true"
              />
            </button>

            <div
              v-if="moreOpen"
              class="bg-nav/90 text-nav-foreground absolute bottom-full left-1/2 z-40 mb-2 w-72 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-3xl border border-white/10 p-3 shadow-lg backdrop-blur-xl"
              role="menu"
            >
              <!-- Account + theme section -->
              <div class="space-y-3 border-b border-white/10 pb-3">
                <button
                  v-if="auth.isSignedIn"
                  type="button"
                  class="hover:bg-nav-foreground/10 flex w-full items-center gap-2.5 rounded-xl p-2 text-left"
                  role="menuitem"
                  @click="goProfile"
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
                    <span
                      v-if="me.displayName"
                      class="block truncate font-serif text-lg font-medium tracking-tight"
                    >
                      {{ me.displayName }}
                    </span>
                    <span
                      v-if="me.email"
                      :class="[
                        'block truncate',
                        me.displayName
                          ? 'opacity-60'
                          : 'font-serif text-lg font-medium tracking-tight',
                      ]"
                    >
                      {{ me.email }}
                    </span>
                  </span>
                  <ChevronRight class="size-4 opacity-60" />
                </button>

                <button
                  v-else
                  type="button"
                  class="hover:bg-nav-foreground/10 flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors"
                  role="menuitem"
                  @click="handleSignIn"
                >
                  <LogIn class="size-4" />
                  <span class="flex-1">Sign in</span>
                </button>

                <div
                  class="bg-nav-foreground/10 grid grid-cols-3 gap-1 rounded-lg p-1"
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
                        ? 'bg-nav-foreground/20 shadow-sm'
                        : 'opacity-70 hover:opacity-100',
                    ]"
                    @click="theme = opt.value"
                  >
                    <component :is="opt.icon" class="size-4" />
                    <span class="text-sm">{{ opt.label }}</span>
                  </button>
                </div>
              </div>

              <RouterLink
                :to="{ name: 'home' }"
                :class="[
                  'mt-3 flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors',
                  route.path === '/'
                    ? 'bg-nav-foreground/10'
                    : 'hover:bg-nav-foreground/10',
                ]"
                role="menuitem"
                @click="moreOpen = false"
              >
                <Home class="size-4" />
                <span class="flex-1">Home</span>
              </RouterLink>

              <button
                v-if="update.updateAvailable"
                type="button"
                class="hover:bg-nav-foreground/10 mt-1 flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors"
                role="menuitem"
                @click="
                  () => {
                    moreOpen = false
                    update.openDialog()
                  }
                "
              >
                <ArrowDownToLine class="size-4" />
                <span class="flex-1">Update available</span>
                <span
                  class="bg-secondary size-2 animate-pulse rounded-full"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <RouterLink
        :to="{ name: 'search' }"
        class="bg-nav/90 text-nav-foreground pointer-events-auto flex size-12 items-center justify-center rounded-full shadow-lg backdrop-blur-xl [view-transition-class:clip] [view-transition-name:nav-right] hover:opacity-90"
        title="Search"
        aria-label="Search"
      >
        <span class="[view-transition-name:match-element]">
          <Search class="size-5" />
        </span>
      </RouterLink>
    </div>
  </nav>
</template>
