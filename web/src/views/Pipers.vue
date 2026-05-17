<script setup lang="ts">
import EntityIndex from '@/components/EntityIndex.vue'

function subtitleOf(agg: { appearanceCount?: number }) {
  const n = agg.appearanceCount ?? 0
  return n === 1 ? '1 competition' : `${n} competitions`
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
