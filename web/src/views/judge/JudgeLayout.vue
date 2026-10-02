<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { provideJudgeProfile } from '@/composables/useJudgeProfile'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const judgeId = computed(() => String(route.params.judgeId ?? ''))

useVtScope('judge').syncFocus(judgeId)

const { displayName, loading, notFound } = provideJudgeProfile(toRef(judgeId))
</script>

<template>
  <EntityLayout
    scope="judge"
    section-route-name="judges"
    :display-name="displayName"
    :loading="loading"
    :not-found="notFound"
    empty-title="Judge not found"
    empty-description="This judge isn’t listed at any competition on ScotDance. The link may be out of date."
  />
</template>
