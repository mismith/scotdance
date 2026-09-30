<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { provideJudgeProfile } from '@/composables/useJudgeProfile'
import { useFavoritesStore } from '@/stores/favorites'
import { initialsOf } from '@/lib/format'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const judgeId = computed(() => String(route.params.judgeId ?? ''))

useVtScope('judge').syncFocus(judgeId)

const { displayName, image, loading, notFound } = provideJudgeProfile(toRef(judgeId))

const favorites = useFavoritesStore()
const initials = computed(() => initialsOf(displayName.value))
const isFavorite = computed(() => favorites.isFavorite('judges', judgeId.value))
</script>

<template>
  <EntityLayout
    :id="judgeId"
    scope="judge"
    id-param="judgeId"
    route-prefix="judge"
    section-route-name="judges"
    :display-name="displayName"
    :image="image"
    :initials="initials"
    :is-favorite="isFavorite"
    :loading="loading"
    :not-found="notFound"
    empty-title="Judge not found"
    empty-description="This judge isn’t listed at any competition on ScotDance. The link may be out of date."
    :tabs="[]"
  />
</template>
