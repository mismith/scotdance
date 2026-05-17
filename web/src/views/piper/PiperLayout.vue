<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { providePiperProfile } from '@/composables/usePiperProfile'
import { initialsOf } from '@/lib/format'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const piperId = computed(() => String(route.params.piperId ?? ''))

useVtScope('piper').syncFocus(piperId)

const { displayName, location, image, loading, notFound } = providePiperProfile(
  toRef(piperId),
)

const initials = computed(() => initialsOf(displayName.value))
</script>

<template>
  <EntityLayout
    scope="piper"
    :id="piperId"
    id-param="piperId"
    route-prefix="piper"
    section-route-name="pipers"
    :display-name="displayName"
    :subtitle="location"
    :image="image"
    :initials="initials"
    :loading="loading"
    :not-found="notFound"
    empty-title="No record of this piper"
    empty-description="This piper profile doesn’t exist or has no appearances."
  />
</template>
