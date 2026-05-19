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
    namespace="pipers"
    vt-scope="piper"
    route-prefix="piper"
    id-param="piperId"
    :subtitle-of="subtitleOf"
  />
</template>
