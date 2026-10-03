<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { provideDancerProfile } from '@/composables/useDancerProfile'

// A dancer across every competition: one page.
const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))


const { displayName, loading, notFound } = provideDancerProfile(toRef(dancerId))
</script>

<template>
  <EntityLayout
    scope="dancer"
    section-route-name="dancers"
    :display-name="displayName"
    :loading="loading"
    :not-found="notFound"
    empty-title="Dancer not found"
    empty-description="This dancer isn’t listed at any competition on ScotDance.app. The link may be out of date; try searching by name."
  />
</template>
