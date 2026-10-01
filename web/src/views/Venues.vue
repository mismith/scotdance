<script setup lang="ts">
import EntityIndex from '@/components/EntityIndex.vue'
import { countryName } from '@/lib/flagEmoji'

function subtitleOf(agg: {
  locality?: string | null
  region?: string | null
  country?: string | null
  appearanceCount?: number
}) {
  const place = [agg.locality, agg.region, agg.country && countryName(agg.country)].filter(Boolean).join(', ')
  const count = (agg.appearanceCount ?? 0)
  const comps = count === 1 ? '1 competition' : `${count} competitions`
  return place ? `${place} · ${comps}` : comps
}
</script>

<template>
  <EntityIndex
    namespace="venues"
    vt-scope="venue"
    route-prefix="venue"
    id-param="venueId"
    :subtitle-of="subtitleOf"
  />
</template>
