<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { School } from '@lucide/vue'
import { provideVenueProfile } from '@/composables/useVenueProfile'
import { useFavoritesStore } from '@/stores/favorites'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const venueId = computed(() => String(route.params.venueId ?? ''))

useVtScope('venue').syncFocus(venueId)

const { name, locationLine, loading, notFound } = provideVenueProfile(toRef(venueId))

const favorites = useFavoritesStore()
const isFavorite = computed(() => favorites.isFavorite('venues', venueId.value))
const isInfo = computed(() => String(route.name ?? '') === 'venue.info')
</script>

<template>
  <EntityLayout
    :id="venueId"
    scope="venue"
    id-param="venueId"
    route-prefix="venue"
    section-route-name="venues"
    :display-name="name"
    :subtitle="locationLine"
    :fallback-icon="School"
    :is-favorite="isFavorite"
    :loading="loading"
    :not-found="notFound"
    empty-title="No record of this venue"
    empty-description="This venue profile doesn’t exist or has no competitions."
  >
    <template #actions>
      <FavoriteButton
        v-if="isInfo"
        :id="venueId"
        type="venues"
        :name="name"
        class="hover:bg-card-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
      />
    </template>
  </EntityLayout>
</template>
