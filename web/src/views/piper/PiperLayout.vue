<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { providePiperProfile } from '@/composables/usePiperProfile'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const piperId = computed(() => String(route.params.piperId ?? ''))

useVtScope('piper').syncFocus(piperId)

const { displayName, loading, notFound } = providePiperProfile(toRef(piperId))
</script>

<template>
  <EntityLayout
    scope="piper"
    section-route-name="pipers"
    :display-name="displayName"
    :loading="loading"
    :not-found="notFound"
    empty-title="Piper not found"
    empty-description="This piper isn’t listed at any competition on ScotDance. The link may be out of date."
  />
</template>
