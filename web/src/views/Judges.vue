<script setup lang="ts">
import EntityIndex from '@/components/EntityIndex.vue'

function subtitleOf(agg: { appearanceCount?: number; location?: string | null }) {
  const n = agg.appearanceCount ?? 0
  const comps = n === 1 ? '1 competition' : `${n} competitions`
  return agg.location ? `${agg.location} · ${comps}` : comps
}
</script>

<template>
  <EntityIndex
    namespace="judges"
    vt-scope="judge"
    route-prefix="judge"
    id-param="judgeId"
    :subtitle-of="subtitleOf"
  />
</template>
