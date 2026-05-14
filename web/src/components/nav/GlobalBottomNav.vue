<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowDownToLine,
  CalendarDays,
  Home,
  MoreHorizontal,
  Search,
  Users,
} from '@lucide/vue'
import { useUpdate } from '@/composables/useUpdate'

const route = useRoute()
const update = useUpdate()

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
</script>

<template>
  <nav
    class="pointer-events-none fixed inset-x-0 bottom-(--nav-bottom) z-30 px-4"
  >
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
              'relative isolate flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3 font-sans font-medium transition-colors',
              tab.isActive()
                ? `before:bg-nav-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:[view-transition-name:nav-left-active]`
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
                'relative isolate flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3 font-sans font-medium transition-colors',
                moreOpen
                  ? `before:bg-nav-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:[view-transition-name:nav-left-active]`
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
              class="bg-nav/90 text-nav-foreground absolute bottom-full left-1/2 z-40 mb-2 w-72 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-3xl border border-white/10 p-3 font-sans shadow-lg backdrop-blur-xl"
              role="menu"
            >
              <RouterLink
                :to="{ name: 'home' }"
                :class="[
                  'flex w-full items-center gap-3 rounded-lg p-2.5 text-base font-medium transition-opacity',
                  route.path === '/'
                    ? 'bg-nav-foreground/10'
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
        </div>
      </div>

      <RouterLink
        :to="{ name: 'search' }"
        class="bg-nav/90 text-nav-foreground pointer-events-auto flex size-16 items-center justify-center rounded-full shadow-lg backdrop-blur-xl [view-transition-class:clip] [view-transition-name:nav-right] hover:opacity-90"
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
