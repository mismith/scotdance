<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { provideVenueProfile } from '@/composables/useVenueProfile'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const venueId = computed(() => String(route.params.venueId ?? ''))

useVtScope('venue').syncFocus(venueId)

const { name, loading, notFound } = provideVenueProfile(toRef(venueId))
</script>

<template>
  <EntityLayout
    scope="venue"
    section-route-name="venues"
    :display-name="name"
    :loading="loading"
    :not-found="notFound"
    empty-title="Venue not found"
    empty-description="This venue isn’t listed for any competition on ScotDance. The link may be out of date."
  />
</template>
