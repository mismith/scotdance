<script setup lang="ts">
import { ref } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowDownToLine,
  Calendars,
  Home,
  MoreHorizontal,
  Search,
  Users,
} from '@lucide/vue'
import { useUpdate } from '@/composables/useUpdate'

const route = useRoute()
const update = useUpdate()

const moreOpen = ref(false)
onKeyStroke('Escape', () => (moreOpen.value = false))

const tabs = [
  {
    name: 'Competitions',
    to: { name: 'competitions' },
    icon: Calendars,
    isActive: () => route.path.startsWith('/competitions'),
  },
  {
    name: 'Dancers',
    to: { name: 'dancers' },
    icon: Users,
    isActive: () => route.path.startsWith('/dancers'),
  },
]
</script>

<template>
  <nav class="pointer-events-none fixed inset-x-0 bottom-(--nav-bottom) z-30 px-4">
    <div class="mx-auto flex max-w-3xl items-center justify-between">
      <div
        class="floating-nav pointer-events-auto flex items-center rounded-full p-1 [view-transition-class:clip] [view-transition-name:nav-left]"
      >
        <RouterLink
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.to"
          :class="[
            'relative isolate flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3 font-sans font-medium transition-colors [view-transition-name:match-element]',
            tab.isActive()
              ? `before:bg-card-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:[view-transition-class:fixed-height] before:[view-transition-name:nav-left-active]`
              : 'opacity-70 hover:opacity-100',
          ]"
        >
          <component :is="tab.icon" class="size-5" />
          <span class="text-xs leading-none">{{ tab.name }}</span>
        </RouterLink>

        <div class="relative [view-transition-name:match-element]">
          <button
            type="button"
            :class="[
              'relative isolate flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3 font-sans font-medium transition-colors',
              moreOpen
                ? `before:bg-card-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:[view-transition-class:fixed-height] before:[view-transition-name:nav-right-active]`
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

          <!-- Backdrop: outside-click absorber so taps below the menu
                 don't activate page content. -->
          <Transition
            enter-active-class="transition ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition ease-out"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="moreOpen"
              class="pointer-events-auto fixed inset-0 z-40"
              aria-hidden="true"
              @click="moreOpen = false"
            />
          </Transition>

          <!-- Menu overlay: morphs out of the More button position
                 (bottom-center of the overlay box) via clip-path. -->
          <Transition
            enter-active-class="transition-[clip-path,opacity] ease-rubber-band"
            enter-from-class="opacity-0 [clip-path:inset(calc(100%-3.5rem)_calc(50%-2rem)_0_calc(50%-2rem)_round_1.75rem)]"
            enter-to-class="opacity-100 [clip-path:inset(0_0_0_0_round_1.5rem)]"
            leave-active-class="transition-[clip-path,opacity] ease-out"
            leave-from-class="opacity-100 [clip-path:inset(0_0_0_0_round_1.5rem)]"
            leave-to-class="opacity-0 [clip-path:inset(calc(100%-3.5rem)_calc(50%-2rem)_0_calc(50%-2rem)_round_1.75rem)]"
          >
            <div
              v-if="moreOpen"
              class="absolute bottom-full left-1/2 z-50 mb-2 -ml-36 w-72 max-w-[calc(100vw-1.5rem)]"
              role="menu"
            >
              <div class="floating-nav w-full overflow-hidden rounded-3xl p-3 font-sans">
                <RouterLink
                  :to="{ name: 'home' }"
                  :class="[
                    'flex w-full items-center gap-3 rounded-lg p-2.5 text-base font-medium transition-opacity',
                    route.path === '/'
                      ? 'bg-card-foreground/10'
                      : 'opacity-70 hover:opacity-100',
                  ]"
                  role="menuitem"
                  @click="moreOpen = false"
                >
                  <Home class="size-5" />
                  <span class="flex-1">Home</span>
                </RouterLink>

                <button
                  v-if="update.updateAvailable"
                  type="button"
                  class="mt-1 flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-base font-medium opacity-70 transition-opacity hover:opacity-100"
                  role="menuitem"
                  @click="
                    () => {
                      moreOpen = false
                      update.openDialog()
                    }
                  "
                >
                  <ArrowDownToLine class="size-5" />
                  <span class="flex-1">Update available</span>
                  <span
                    class="bg-secondary size-2 animate-pulse rounded-full"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <RouterLink
        :to="{ name: 'search' }"
        class="floating-nav pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full [view-transition-class:clip] [view-transition-name:nav-right] hover:opacity-90"
        title="Search"
        aria-label="Search"
      >
        <Search
          class="size-5 [view-transition-class:fit] [view-transition-name:nav-right-icon]"
        />
      </RouterLink>
    </div>
  </nav>
</template>
