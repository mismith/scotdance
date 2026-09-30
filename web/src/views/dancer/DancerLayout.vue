<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { provideDancerProfile } from '@/composables/useDancerProfile'
import { initialsOf } from '@/lib/format'
import { useVtScope } from '@/lib/viewTransitionFocus'

// A dancer across every competition: one page, no tabs.
const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

useVtScope('dancer').syncFocus(dancerId)

const { displayName, image, loading, notFound } = provideDancerProfile(toRef(dancerId))
const initials = computed(() => initialsOf(displayName.value))
</script>

<template>
  <EntityLayout
    :id="dancerId"
    scope="dancer"
    id-param="dancerId"
    route-prefix="dancer"
    section-route-name="dancers"
    :display-name="displayName"
    :image="image"
    :initials="initials"
    :loading="loading"
    :not-found="notFound"
    empty-title="Dancer not found"
    empty-description="This dancer isn’t listed at any competition on ScotDance. The link may be out of date; try searching by name."
    :tabs="[]"
  />
</template>
