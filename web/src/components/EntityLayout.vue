<script setup lang="ts">
import { computed, type Component } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppBar from '@/components/nav/AppBar.vue'
import ShareButton from '@/components/ShareButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { sectionMeta } from '@/lib/sectionMeta'
import { usePageTitle } from '@/composables/usePageTitle'
import { provideInfoHeader } from '@/composables/useScrolledPast'

// Shared shell for profile pages (dancer, judge, piper, venue). The app-wide
// tab bar stays at the bottom (the bar only changes inside a competition);
// a profile's own sections, if it has more than one, are a labelled control
// at the top of the page.

type Tab = { name: string; to: string; icon: Component }

const props = withDefaults(
  defineProps<{
    scope: 'judge' | 'piper' | 'venue' | 'dancer'
    id: string
    idParam: string
    routePrefix: string
    /** Route name of the section index this profile belongs to (e.g. 'judges'). */
    sectionRouteName: string
    displayName: string
    image?: string | null
    fallbackIcon?: Component
    initials?: string
    loading: boolean
    notFound: boolean
    emptyTitle: string
    emptyDescription: string
    /** Sections of the profile. Defaults to Info + Competitions; pass [] for one page. */
    tabs?: Tab[]
    isFavorite?: boolean
  }>(),
  { image: null, initials: '', isFavorite: false, tabs: undefined, fallbackIcon: undefined },
)

const route = useRoute()
const section = computed(() => sectionMeta(props.sectionRouteName))

const resolvedTabs = computed<Tab[]>(
  () =>
    props.tabs ?? [
      { name: 'About', to: `${props.routePrefix}.info`, icon: section.value.icon as Component },
      { name: 'Competitions', to: `${props.routePrefix}.competitions`, icon: section.value.icon as Component },
    ],
)
const activeTab = computed(() => resolvedTabs.value.find((t) => t.to === String(route.name ?? ''))?.to)
const activeLabel = computed(() => resolvedTabs.value.find((t) => t.to === activeTab.value)?.name)

usePageTitle(() => [
  resolvedTabs.value.length > 1 && activeTab.value !== resolvedTabs.value[0]?.to ? activeLabel.value : null,
  props.notFound ? 'Not found' : props.displayName,
])

const params = computed(() => ({ [props.idParam]: props.id }))
const { scrolledPast } = provideInfoHeader()
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar
      :title="displayName"
      :show-title="scrolledPast"
      :fallback="{ to: section.to, label: section.label }"
    >
      <template #actions>
        <ShareButton :title="displayName || undefined" />
      </template>
    </AppBar>

    <main class="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
      <EmptyState
        v-if="!loading && notFound"
        :icon="section.icon"
        :title="emptyTitle"
        :description="emptyDescription"
      />
      <template v-else>
        <div v-if="$slots.actions" class="flex flex-wrap gap-2">
          <slot name="actions" />
        </div>
        <nav
          v-if="resolvedTabs.length > 1"
          class="bg-muted grid rounded-xl border p-1"
          :style="{ gridTemplateColumns: `repeat(${resolvedTabs.length}, minmax(0, 1fr))` }"
          :aria-label="`${displayName} sections`"
        >
          <RouterLink
            v-for="tab in resolvedTabs"
            :key="tab.to"
            :to="{ name: tab.to, params }"
            :aria-current="activeTab === tab.to ? 'page' : undefined"
            :class="[
              'flex h-10 items-center justify-center rounded-lg text-[0.9375rem] font-bold transition-colors',
              activeTab === tab.to ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            ]"
          >
            {{ tab.name }}
          </RouterLink>
        </nav>
        <RouterView />
      </template>
    </main>
  </div>
</template>
