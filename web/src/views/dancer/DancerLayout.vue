<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import DancerHideButton from '@/components/admin/DancerHideButton.vue'
import { provideDancerProfile } from '@/composables/useDancerProfile'
import { provideDancerRecord } from '@/composables/useDancerRecord'

// A dancer across every competition: one page. Signed in (and not hidden by
// a family's request) it lists every competition; otherwise the latest few.
const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

const profile = provideDancerProfile(toRef(dancerId))
const { displayName, loading, notFound } = profile
provideDancerRecord(dancerId, profile)
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
  >
    <template #actions>
      <DancerHideButton :dancer-id="dancerId" :name="displayName" />
    </template>
  </EntityLayout>
</template>
