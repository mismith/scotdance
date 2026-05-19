<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowDownToLine,
  MoreHorizontal,
  Search as SearchIcon,
  X,
} from '@lucide/vue'
import { useUpdate } from '@/composables/useUpdate'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import { backPath, preferBackClick } from '@/lib/back'
import { isIos } from '@/lib/platform'
import { sectionMeta } from '@/lib/sectionMeta'

const route = useRoute()
const router = useRouter()
const update = useUpdate()

const { q, inputEl } = useGlobalSearch()

const moreOpen = ref(false)
onKeyStroke('Escape', () => (moreOpen.value = false))

const isSearch = computed(() => route.name === 'search')

const tabs = [
  { ...sectionMeta('competitions'), isActive: () => route.path.startsWith('/competitions') },
  { ...sectionMeta('dancers'), isActive: () => route.path.startsWith('/dancers') },
]

const entityLinks = [
  sectionMeta('judges'),
  sectionMeta('pipers'),
  sectionMeta('venues'),
]

const aboutLink = sectionMeta('about')

// Show the More button as active when its dropdown is open OR the current
// route is one of the links nested inside it (entity links + the About
// link at the top).
const moreActive = computed(
  () =>
    moreOpen.value
    || route.path === aboutLink.path
    || entityLinks.some((e) => route.path.startsWith(e.path)),
)

// /search is a leaf — the back-target is whichever route we came from. We
// track it via a ref updated on every nav (rather than reading window.history
// inline from a computed), since `window.history.state` isn't a reactive
// source and a computed wouldn't otherwise know to refresh.
const previousFullPath = ref<string | null>(backPath())
watch(() => route.fullPath, () => { previousFullPath.value = backPath() })

// Resolves the back path to the section that owns it (via the deepest matched
// route carrying an `icon` meta). No hardcoded list — adding a new section is
// just adding meta to its route.
const competitionsLink = sectionMeta('competitions')
const backInfo = computed(() => {
  const back = previousFullPath.value
  if (back) {
    const matched = router.resolve(back).matched
    const section = [...matched].reverse().find((r) => r.meta.icon && r.name)
    if (section) {
      return {
        icon: section.meta.icon!,
        label: `Back to ${section.meta.title ?? String(section.name)}`,
        to: { name: section.name as string },
      }
    }
  }
  // Deep-link entry to /search with no resolvable previous: send them to the
  // primary landing section.
  return {
    icon: competitionsLink.icon,
    label: `Back to ${competitionsLink.label}`,
    to: competitionsLink.to,
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
          :key="tab.label"
          :to="tab.to"
          :class="[
            'relative isolate flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3 font-sans font-medium transition-colors [view-transition-name:match-element]',
            tab.isActive()
              ? `before:bg-card-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:[view-transition-class:fixed-height] before:[view-transition-name:nav-left-active]`
              : 'opacity-70 hover:opacity-100',
          ]"
        >
          <component :is="tab.icon" class="size-5" />
          <span class="text-xs leading-none">{{ tab.label }}</span>
        </RouterLink>

        <div class="relative [view-transition-name:match-element]">
          <button
            type="button"
            :class="[
              'relative isolate flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3 font-sans font-medium transition-colors',
              moreActive
                ? `before:bg-card-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:[view-transition-class:fixed-height] before:[view-transition-name:nav-left-active]`
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
                  :to="aboutLink.to"
                  :class="[
                    'flex w-full items-center gap-3 rounded-lg p-2.5 text-base font-medium transition-opacity',
                    route.path === '/'
                      ? 'bg-card-foreground/10'
                      : 'opacity-70 hover:opacity-100',
                  ]"
                  role="menuitem"
                  @click="moreOpen = false"
                >
                  <component :is="aboutLink.icon" class="size-5" />
                  <span class="flex-1">{{ aboutLink.label }}</span>
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

                <hr class="border-card-foreground/10 my-2" />

                <RouterLink
                  v-for="(entity, i) in entityLinks"
                  :key="entity.label"
                  :to="entity.to"
                  :class="[
                    'flex w-full items-center gap-3 rounded-lg p-2.5 text-base font-medium transition-opacity',
                    i > 0 && 'mt-1',
                    route.path.startsWith(entity.path)
                      ? 'bg-card-foreground/10'
                      : 'opacity-70 hover:opacity-100',
                  ]"
                  role="menuitem"
                  @click="moreOpen = false"
                >
                  <component :is="entity.icon" class="size-5" />
                  <span class="flex-1">{{ entity.label }}</span>
                </RouterLink>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- RIGHT pill: same DOM node across routes so iOS keyboard survives the
           about → /search nav. <label> wraps the input so a tap focuses it
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
