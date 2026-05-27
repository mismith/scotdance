<script setup lang="ts">
import { computed } from 'vue'
import { useJudgeProfile } from '@/composables/useJudgeProfile'
import EntityAppearanceList, {
  type AppearanceItem,
} from '@/components/EntityAppearanceList.vue'
import { isSameDay } from '@/lib/format'

const profile = useJudgeProfile()

const items = computed<AppearanceItem[]>(() => {
  const seen = new Set<string>()
  const list: AppearanceItem[] = []
  for (const a of profile.appearances.value) {
    if (!a.competition || !a.raw.competitionId) continue
    if (seen.has(a.raw.competitionId)) continue
    seen.add(a.raw.competitionId)
    list.push({
      competition: { id: a.raw.competitionId, ...a.competition },
      isLive: isSameDay(a.competition.date),
      liveLabel: 'Judging now',
    })
  }
  return list
})

function toResolver(item: AppearanceItem) {
  return {
    name: 'competition.info',
    params: { competitionId: item.competition.id },
  }
}
</script>

<template>
  <EntityAppearanceList
    :items="items"
    :to-resolver="toResolver"
    storage-prefix="judge:competitions"
    :loading="profile.loading.value"
    empty-message="No appearances on record."
  />
</template>
