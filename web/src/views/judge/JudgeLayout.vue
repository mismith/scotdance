<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
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
const isInfo = computed(() => String(route.name ?? '') === 'judge.info')
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
    empty-title="No record of this judge"
    empty-description="This judge profile doesn’t exist or has no appearances."
  >
    <template #actions>
      <FavoriteButton
        v-if="isInfo"
        :id="judgeId"
        type="judges"
        :name="displayName"
        class="hover:bg-card-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
      />
    </template>
  </EntityLayout>
</template>
