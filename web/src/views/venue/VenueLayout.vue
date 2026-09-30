<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { School } from '@lucide/vue'
import { provideVenueProfile } from '@/composables/useVenueProfile'
import { useFavoritesStore } from '@/stores/favorites'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const venueId = computed(() => String(route.params.venueId ?? ''))

useVtScope('venue').syncFocus(venueId)

const { name, loading, notFound } = provideVenueProfile(toRef(venueId))

const favorites = useFavoritesStore()
const isFavorite = computed(() => favorites.isFavorite('venues', venueId.value))
</script>

<template>
  <EntityLayout
    :id="venueId"
    scope="venue"
    id-param="venueId"
    route-prefix="venue"
    section-route-name="venues"
    :display-name="name"
    :fallback-icon="School"
    :is-favorite="isFavorite"
    :loading="loading"
    :not-found="notFound"
    empty-title="Venue not found"
    empty-description="This venue isn’t listed for any competition on ScotDance. The link may be out of date."
    :tabs="[]"
  />
</template>
