<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowDownToLine,
  CalendarDays,
  Monitor,
  Moon,
  MoreHorizontal,
  Search,
  Sun,
  Users,
} from '@lucide/vue'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useUpdate } from '@/composables/useUpdate'

const route = useRoute()
const update = useUpdate()
const { theme } = useTheme()

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
</script>

<template>
  <nav
    class="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3"
  >
    <div class="pointer-events-auto flex items-center gap-2">
      <div
        class="bg-nav text-nav-foreground flex items-center gap-1 rounded-full p-1 shadow-lg"
      >
        <RouterLink
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.to"
          :class="[
            'flex flex-col items-center gap-0.5 rounded-full px-4 py-1 text-xs font-medium transition-colors',
            tab.isActive() ? 'bg-nav-foreground/10' : 'opacity-70 hover:opacity-100',
          ]"
        >
          <component :is="tab.icon" class="size-4" />
          <span class="text-[10px]">{{ tab.name }}</span>
        </RouterLink>

        <div ref="moreRef" class="relative">
          <button
            type="button"
            :class="[
              'flex flex-col items-center gap-0.5 rounded-full px-4 py-1 text-xs font-medium transition-colors',
              moreOpen ? 'bg-nav-foreground/10' : 'opacity-70 hover:opacity-100',
            ]"
            :aria-expanded="moreOpen"
            aria-haspopup="menu"
            @click="moreOpen = !moreOpen"
          >
            <MoreHorizontal class="size-4" />
            <span class="text-[10px]">More</span>
            <span
              v-if="update.updateAvailable"
              class="bg-secondary absolute top-1 right-1 size-2 rounded-full"
              aria-hidden="true"
            />
          </button>

          <div
            v-if="moreOpen"
            class="bg-popover text-popover-foreground absolute right-0 bottom-full z-40 mb-2 w-64 space-y-3 rounded-md border p-3 shadow-lg"
            role="menu"
          >
            <div>
              <div
                class="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase"
              >
                Theme
              </div>
              <div
                class="bg-muted grid grid-cols-3 gap-1 rounded-md p-1"
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
                    'flex items-center justify-center gap-1.5 rounded-sm py-1.5 text-xs font-medium transition-colors',
                    theme === opt.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  ]"
                  @click="theme = opt.value"
                >
                  <component :is="opt.icon" class="size-3.5" />
                  <span>{{ opt.label }}</span>
                </button>
              </div>
            </div>

            <button
              v-if="update.updateAvailable"
              type="button"
              class="hover:bg-accent flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm"
              @click="
                () => {
                  moreOpen = false
                  update.openDialog()
                }
              "
            >
              <ArrowDownToLine class="text-secondary size-4" />
              <span class="flex-1">Update available</span>
              <span class="bg-secondary size-2 rounded-full" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <RouterLink
        :to="{ name: 'search' }"
        class="bg-nav text-nav-foreground flex size-12 items-center justify-center rounded-full shadow-lg hover:opacity-90"
        title="Search"
        aria-label="Search"
      >
        <Search class="size-5" />
      </RouterLink>
    </div>
  </nav>
</template>
