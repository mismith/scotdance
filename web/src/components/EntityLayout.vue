<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import AppBar from '@/components/nav/AppBar.vue'
import SidebarBranch from '@/components/nav/SidebarBranch.vue'
import Button from '@/components/ui/Button.vue'
import ShareButton from '@/components/ShareButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { sectionMeta } from '@/lib/sectionMeta'
import { usePageTitle } from '@/composables/usePageTitle'
import { provideInfoHeader } from '@/composables/useScrolledPast'

// Shared shell for profile pages (dancer, judge, piper, venue): the bar,
// the page (each profile's Info), and a way on when the link is stale. On
// wide screens the page puts its header in a column of its own that stays
// put (lib/profile).

const props = defineProps<{
  scope: 'judge' | 'piper' | 'venue' | 'dancer'
  /** Route name of the section index this profile belongs to (e.g. 'judges'). */
  sectionRouteName: string
  displayName: string
  loading: boolean
  notFound: boolean
  emptyTitle: string
  emptyDescription: string
}>()

const section = computed(() => sectionMeta(props.sectionRouteName))

usePageTitle(() => [props.notFound ? 'Not found' : props.displayName])

const { scrolledPast } = provideInfoHeader()
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar
      :title="displayName"
      :show-title="scrolledPast"
      :fallback="{ to: section.to, label: section.label }"
    >
      <template v-if="!notFound" #actions>
        <ShareButton :title="displayName || undefined" />
      </template>
    </AppBar>

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
      <EmptyState
        v-if="!loading && notFound"
        :icon="section.icon"
        :title="emptyTitle"
        :description="emptyDescription"
      >
        <Button variant="primary" size="lg" :to="section.to">
          {{ scope === 'dancer' ? 'Find a dancer' : `All ${section.label.toLowerCase()}` }}
        </Button>
      </EmptyState>
      <RouterView v-else />
    </main>
    <!-- Wide screens: this profile, nested under its list in the sidebar. -->
    <SidebarBranch v-if="displayName" :under="sectionRouteName" :label="displayName" :to="$route.path" current />
  </div>
</template>
