<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { provideJudgeProfile } from '@/composables/useJudgeProfile'
import { initialsOf } from '@/lib/format'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const judgeId = computed(() => String(route.params.judgeId ?? ''))

useVtScope('judge').syncFocus(judgeId)

const { displayName, location, image, loading, notFound } = provideJudgeProfile(
  toRef(judgeId),
)

const initials = computed(() => initialsOf(displayName.value))
</script>

<template>
  <EntityLayout
    scope="judge"
    :id="judgeId"
    id-param="judgeId"
    route-prefix="judge"
    section-route-name="judges"
    :display-name="displayName"
    :subtitle="location"
    :image="image"
    :initials="initials"
    :loading="loading"
    :not-found="notFound"
    empty-title="No record of this judge"
    empty-description="This judge profile doesn’t exist or has no appearances."
  />
</template>
