<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { School } from '@lucide/vue'
import { provideVenueProfile } from '@/composables/useVenueProfile'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const venueId = computed(() => String(route.params.venueId ?? ''))

useVtScope('venue').syncFocus(venueId)

const { name, locationLine, loading, notFound } = provideVenueProfile(toRef(venueId))
</script>

<template>
  <EntityLayout
    scope="venue"
    :id="venueId"
    id-param="venueId"
    route-prefix="venue"
    section-route-name="venues"
    :display-name="name"
    :subtitle="locationLine"
    :fallback-icon="School"
    :loading="loading"
    :not-found="notFound"
    empty-title="No record of this venue"
    empty-description="This venue profile doesn’t exist or has no competitions."
  />
</template>
