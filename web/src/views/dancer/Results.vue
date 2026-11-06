<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { Trophy } from '@lucide/vue'
import { useDancerProfile } from '@/composables/useDancerProfile'
import { useDancerRecord } from '@/composables/useDancerRecord'
import ByDance from '@/components/dancer/ByDance.vue'
import CompetitionList from '@/components/dancer/CompetitionList.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import Segmented from '@/components/ui/Segmented.vue'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { swapInPlace } from '@/lib/navMotion'

// Every result, two ways: a List of competitions, a season at a time (the
// default), or By dance (each dance across the seasons). The choice is kept
// for next time.
type View = 'dance' | 'list'
const VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'list', label: 'List' },
  { value: 'dance', label: 'By dance' },
]

const route = useRoute()
// The bar frosts once this page's heading scrolls under it, not before.
const setHeader = injectInfoHeaderSetter()
const profile = useDancerProfile()
const record = useDancerRecord()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

const saved = useLocalStorage<View>('dancer-results-view', 'list')
const view = computed<View>(() => (saved.value === 'dance' ? 'dance' : 'list'))
const setView = (v: View) => swapInPlace(VIEWS.map((o) => o.value), view.value, v, () => (saved.value = v))

const loading = computed(() => profile.loading.value || (profile.appearances.value.length > 0 && !record.rows.value.length))
</script>

<template>
  <div v-if="record.rich.value" class="space-y-4">
    <div :ref="setHeader" data-page-head class="flex items-center justify-between gap-3">
      <h1 class="text-section">Results</h1>
      <Segmented :model-value="view" :options="VIEWS" label="Show results as" class="shrink-0" @update:model-value="setView" />
    </div>

    <EmptyState
      v-if="!loading && !record.rows.value.length"
      :icon="Trophy"
      size="inline"
      title="No results yet"
      description="Competitions and their results show here as they’re posted on ScotDance.app."
    />

    <template v-else-if="view === 'dance'">
      <div v-if="!record.ready.value" class="space-y-3" aria-busy="true">
        <span class="sr-only">Loading results…</span>
        <Skeleton class="h-6 w-1/3" />
        <Skeleton class="h-24 w-full rounded-2xl!" />
        <Skeleton class="h-6 w-1/4" />
        <Skeleton class="h-24 w-full rounded-2xl!" />
      </div>
      <EmptyState
        v-else-if="!record.byDance.value.dances.length && !record.byDance.value.overall"
        :icon="Trophy"
        size="inline"
        title="No dances yet"
        description="Dances show here once a competition posts results."
      />
      <ByDance v-else :dances="record.byDance.value.dances" :overall="record.byDance.value.overall" />
    </template>

    <template v-else>
      <CompetitionList :years="record.bySeason.value" :dancer-id="dancerId" headings :loading="loading" />
    </template>
  </div>
</template>
