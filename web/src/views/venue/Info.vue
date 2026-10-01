<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ExternalLink, MapPin } from '@lucide/vue'
import { useVenueProfile } from '@/composables/useVenueProfile'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import FavoriteButton from '@/components/FavoriteButton.vue'
import MapPreview from '@/components/MapPreview.vue'
import ProfileCompetitions from '@/components/ProfileCompetitions.vue'

// A venue: where it is, how to get there, and what's on there.
const setHeader = injectInfoHeaderSetter()
const route = useRoute()
const p = useVenueProfile()
const id = computed(() => String(route.params.venueId ?? ''))

const address = computed(() => {
  const a = p.appearances.value.find((x) => (x.raw as { address?: string | null }).address)
  return (a?.raw as { address?: string | null } | undefined)?.address ?? null
})
const mapsHref = computed(() => {
  const q = [p.name.value, address.value, p.locationLine.value].filter(Boolean).join(', ')
  return q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : null
})
const items = computed(() => {
  const seen = new Set<string>()
  return p.appearances.value.flatMap((a) => {
    const cid = a.raw.competitionId
    if (!cid || !a.competition || seen.has(cid)) return []
    seen.add(cid)
    return [{ competitionId: cid, competition: a.competition }]
  })
})
</script>

<template>
  <article class="space-y-4">
    <header :ref="setHeader" class="flex items-center gap-4">
      <span class="bg-blue-paper text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl">
        <MapPin class="size-7" />
      </span>
      <div class="min-w-0">
        <h1 class="text-display">{{ p.name.value }}</h1>
        <p class="text-muted-foreground text-sm">{{ [address, p.locationLine.value].filter(Boolean).join(', ') }}</p>
      </div>
    </header>

    <div class="flex flex-wrap gap-2">
      <FavoriteButton :id="id" type="venues" :name="p.name.value" labelled />
      <a
        v-if="mapsHref"
        :href="mapsHref"
        target="_blank"
        rel="noopener"
        class="bg-card border-strong flex h-11 items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-bold"
      >
        Directions <ExternalLink class="size-4" />
      </a>
    </div>

    <MapPreview
      v-if="p.lat.value != null && p.lng.value != null"
      :lat="p.lat.value"
      :lng="p.lng.value"
      :href="mapsHref"
      class="h-48 rounded-2xl border shadow-sm"
    />

    <ProfileCompetitions :items="items" :loading="p.loading.value" empty-text="No competitions listed here yet." />
  </article>
</template>
