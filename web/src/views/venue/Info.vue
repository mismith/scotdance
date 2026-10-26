<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { MapPin, Navigation } from '@lucide/vue'
import { useVenueProfile } from '@/composables/useVenueProfile'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import FavoriteButton from '@/components/FavoriteButton.vue'
import MapPreview from '@/components/MapPreview.vue'
import ProfileCompetitions from '@/components/ProfileCompetitions.vue'
import { heroTitle } from '@/lib/heroTitle'
import { profileColumns, profileHeader } from '@/lib/profile'

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
  <article :class="profileColumns">
    <div :class="profileHeader">
      <header :ref="setHeader" class="flex flex-col items-center gap-4">
        <span class="bg-blue-paper text-primary flex size-24 shrink-0 items-center justify-center rounded-3xl" aria-hidden="true">
          <MapPin class="size-10" />
        </span>
        <div class="min-w-0">
          <h1 :class="heroTitle(p.name.value)">{{ p.name.value }}</h1>
          <p class="text-muted-foreground text-callout mt-1.5">{{ [address, p.locationLine.value].filter(Boolean).join(', ') }}</p>
        </div>
      </header>

      <!-- What you can do here, in one row of equal buttons. -->
      <div class="grid w-full max-w-md auto-cols-fr grid-flow-col gap-2">
        <FavoriteButton :id="id" type="venues" :name="p.name.value" labelled variant="tile" />
        <a v-if="mapsHref" :href="mapsHref" target="_blank" rel="noopener" class="press action-tile bg-blue-paper text-primary">
          <Navigation aria-hidden="true" /> Directions
        </a>
      </div>

      <MapPreview
        v-if="p.lat.value != null && p.lng.value != null"
        :lat="p.lat.value"
        :lng="p.lng.value"
        :href="mapsHref"
        class="surface h-48 self-stretch overflow-hidden rounded-2xl text-left"
      />
    </div>

    <div class="space-y-5">
      <ProfileCompetitions :items="items" :loading="p.loading.value" empty-text="No competitions listed here yet." />
    </div>
  </article>
</template>
