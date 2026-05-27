<script setup lang="ts">
import { computed } from 'vue'
import { useDancerProfile } from '@/composables/useDancerProfile'
import EntityAppearanceList, {
  type AppearanceItem,
} from '@/components/EntityAppearanceList.vue'
import StatGrid from '@/components/StatGrid.vue'
import { isSameDay } from '@/lib/format'

const profile = useDancerProfile()

const tiles = computed(() => [
  { label: '1st', value: null },
  { label: 'Top 3', value: null },
  { label: 'Avg', value: null },
])

// Dedup by {competitionId}:{number} so the same registration (same comp,
// same bib) collapses to one row. Different bib numbers at the same comp
// stay separate — they're distinct entries (e.g. multiple age categories).
const items = computed<AppearanceItem[]>(() => {
  const seen = new Set<string>()
  const list: AppearanceItem[] = []
  for (const a of profile.appearances.value) {
    if (!a.competition || !a.raw.competitionId) continue
    const key = `${a.raw.competitionId}:${a.raw.number ?? '∅'}`
    if (seen.has(key)) continue
    seen.add(key)
    list.push({
      competition: { id: a.raw.competitionId, ...a.competition },
      number: a.raw.number ?? null,
      isLive: isSameDay(a.competition.date),
      liveLabel: 'Dancing now',
    })
  }
  return list
})

// Per-comp dancerId lookup so toResolver can deep-link to the dancer's
// result page (competition.dancer) instead of falling back to comp.info.
const dancerIdByComp = computed(() => {
  const map = new Map<string, string>()
  for (const a of profile.appearances.value) {
    if (a.raw.competitionId && a.raw.dancerId && !map.has(a.raw.competitionId)) {
      map.set(a.raw.competitionId, a.raw.dancerId)
    }
  }
  return map
})

function toResolver(item: AppearanceItem) {
  const dancerId = dancerIdByComp.value.get(item.competition.id)
  if (!dancerId) {
    return { name: 'competition.info', params: { competitionId: item.competition.id } }
  }
  return {
    name: 'competition.dancer',
    params: { competitionId: item.competition.id, dancerId },
  }
}
</script>

<template>
  <article class="space-y-5">
    <section>
      <StatGrid :stats="tiles" />
      <p class="text-muted-foreground mt-2 px-1">
        Aggregated stats across competitions need per-comp results loaded. Coming soon.
      </p>
    </section>

    <EntityAppearanceList
      :items="items"
      :to-resolver="toResolver"
      storage-prefix="dancer:results"
      :loading="profile.loading.value"
      empty-message="No appearances on record."
    />
  </article>
</template>
