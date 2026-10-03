<script setup lang="ts">
import { MapPin } from '@lucide/vue'
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
    route-prefix="venue"
    id-param="venueId"
    :subtitle-of="subtitleOf"
    placeholder="Find a venue by name"
    :places="MapPin"
  />
</template>
