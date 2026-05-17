<script setup lang="ts">
import EntityIndex from '@/components/EntityIndex.vue'

function subtitleOf(agg: { appearanceCount?: number }) {
  const n = agg.appearanceCount ?? 0
  return n === 1 ? '1 competition' : `${n} competitions`
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
