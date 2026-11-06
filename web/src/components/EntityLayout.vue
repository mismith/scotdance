<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppBar from '@/components/nav/AppBar.vue'
import PageStack from '@/components/nav/PageStack.vue'
import SidebarBranch from '@/components/nav/SidebarBranch.vue'
import Button from '@/components/ui/Button.vue'
import ShareButton from '@/components/ShareButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { sectionMeta } from '@/lib/sectionMeta'
import { usePageTitle } from '@/composables/usePageTitle'
import { provideInfoHeader } from '@/composables/useScrolledPast'

const route = useRoute()

// Shared shell for profile pages (dancer, judge, piper, venue, organisation): the bar,
// the page (each profile's Info), and a way on when the link is stale. On
// wide screens the page puts its header in a column of its own that stays
// put (lib/profile). A profile can add bar actions and its own bottom nav.

const props = defineProps<{
  scope: 'judge' | 'piper' | 'venue' | 'dancer' | 'organisation'
  /** Route name of the section index this profile belongs to (e.g. 'judges'). */
  sectionRouteName: string
  displayName: string
  loading: boolean
  notFound: boolean
  emptyTitle: string
  emptyDescription: string
  /** The name in the bar on every page, not only once the page's big title scrolls away (pages without one). */
  titleAlways?: boolean
}>()

const section = computed(() => sectionMeta(props.sectionRouteName))

usePageTitle(() => [props.notFound ? 'Not found' : props.displayName])

const { scrolledPast } = provideInfoHeader()
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar
      :title="displayName"
      :show-title="titleAlways || scrolledPast"
      :scrolled="scrolledPast"
      :fallback="{ to: section.to, label: section.label }"
    >
      <template v-if="!notFound" #actions>
        <slot name="actions" />
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
      <PageStack v-else block />
    </main>
    <!-- A profile with its own tabs brings its bottom nav (and the sidebar's
         branch with them); otherwise the app's, and on wide screens this
         profile nested under its list in the sidebar. -->
    <slot name="nav">
      <SidebarBranch v-if="displayName" :under="sectionRouteName" :label="displayName" :to="route.path" current />
    </slot>
  </div>
</template>
