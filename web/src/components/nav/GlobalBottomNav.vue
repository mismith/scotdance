<script setup lang="ts">
import { computed, ref } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowDownToLine,
  Calendars,
  Home,
  MoreHorizontal,
  Search as SearchIcon,
  Users,
  X,
} from '@lucide/vue'
import { useUpdate } from '@/composables/useUpdate'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import { backPath, preferBackClick } from '@/lib/back'
import { isIos } from '@/lib/platform'

const route = useRoute()
const router = useRouter()
const update = useUpdate()

const { q, inputEl } = useGlobalSearch()

const moreOpen = ref(false)
onKeyStroke('Escape', () => (moreOpen.value = false))

const isSearch = computed(() => route.name === 'search')

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

// /search is a leaf — the back-target is whichever route we came from. Resolve
// each time isSearch flips on so re-entering /search after navigating away
// picks a fresh target.
const backInfo = computed(() => {
  const back = backPath()
  if (back === '/') {
    return { icon: Home, label: 'Back to Home', to: { name: 'home' as const } }
  }
  if (back && back.startsWith('/dancers')) {
    return { icon: Users, label: 'Back to Dancers', to: { name: 'dancers' as const } }
  }
  return {
    icon: Calendars,
    label: 'Back to Competitions',
    to: { name: 'competitions' as const },
  }
})

// Tapping the search pill on a non-/search route: the <label> natively focuses
// the input (iOS opens the keyboard), then we push the route. The input itself
// is the same DOM node on /search, so focus carries through the route change.
function onSearchPillClick() {
  if (isSearch.value) return
  router.push({ name: 'search' })
}

function clearSearch() {
  q.value = ''
  inputEl.value?.focus()
}
</script>

<template>
  <nav
    :class="[
      'pointer-events-none inset-x-0 bottom-(--nav-bottom) z-30 px-4',
      isSearch && isIos ? 'absolute' : 'fixed',
    ]"
  >
    <div
      :class="[
        'mx-auto flex max-w-3xl items-center gap-2',
        isSearch ? '' : 'justify-between',
      ]"
    >
      <!-- LEFT pill: tabs+More on browse routes, Back on /search -->
      <RouterLink v-if="isSearch" v-slot="{ href, navigate }" :to="backInfo.to" custom>
        <a
          :href="href"
          class="floating-nav pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full [view-transition-class:clip] [view-transition-name:nav-left] hover:opacity-90"
          :title="backInfo.label"
          :aria-label="backInfo.label"
          @click="preferBackClick(router, $event, navigate)"
        >
          <span class="[view-transition-name:match-element]">
            <component :is="backInfo.icon" class="size-5" />
          </span>
        </a>
      </RouterLink>

      <div
        v-else
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

      <!-- RIGHT pill: same DOM node across routes so iOS keyboard survives the
           home → /search nav. <label> wraps the input so a tap focuses it
           natively (gesture-bound), then onSearchPillClick pushes the route. -->
      <label
        :class="[
          'floating-nav pointer-events-auto flex items-center [view-transition-class:clip] [view-transition-name:nav-right] hover:opacity-90',
          isSearch
            ? 'h-16 min-w-0 flex-1 gap-2 rounded-full px-5'
            : 'size-16 shrink-0 justify-center rounded-full',
        ]"
        :aria-label="isSearch ? undefined : 'Search'"
        :title="isSearch ? undefined : 'Search'"
        @click="onSearchPillClick"
      >
        <span
          :class="[
            'flex items-center [view-transition-class:fit] [view-transition-name:nav-right-icon]',
            isSearch ? 'min-w-0 flex-1 gap-2' : 'gap-0',
          ]"
        >
          <SearchIcon class="size-5 shrink-0 opacity-80" />
          <input
            ref="inputEl"
            v-model="q"
            type="search"
            placeholder="Search"
            aria-label="Search"
            :tabindex="isSearch ? 0 : -1"
            :class="[
              'bg-transparent text-lg focus:outline-none [&::-webkit-search-cancel-button]:hidden',
              isSearch
                ? '-my-0.5 min-w-0 flex-1'
                : 'pointer-events-none h-0 w-0 p-0 opacity-0',
            ]"
          />
        </span>
        <button
          v-if="isSearch && q"
          type="button"
          class="text-card-foreground/70 hover:text-card-foreground -mr-3 flex size-10 shrink-0 items-center justify-center rounded-full"
          title="Clear"
          aria-label="Clear search"
          @click.stop.prevent="clearSearch"
        >
          <X class="size-5" />
        </button>
      </label>
    </div>
  </nav>
</template>
