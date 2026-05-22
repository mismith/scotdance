<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { providePiperProfile } from '@/composables/usePiperProfile'
import { useFavoritesStore } from '@/stores/favorites'
import { initialsOf } from '@/lib/format'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const piperId = computed(() => String(route.params.piperId ?? ''))

useVtScope('piper').syncFocus(piperId)

const { displayName, image, loading, notFound } = providePiperProfile(toRef(piperId))

const favorites = useFavoritesStore()
const initials = computed(() => initialsOf(displayName.value))
const isFavorite = computed(() => favorites.isFavorite('pipers', piperId.value))
const isInfo = computed(() => String(route.name ?? '') === 'piper.info')
</script>

<template>
  <EntityLayout
    :id="piperId"
    scope="piper"
    id-param="piperId"
    route-prefix="piper"
    section-route-name="pipers"
    :display-name="displayName"
    :image="image"
    :initials="initials"
    :is-favorite="isFavorite"
    :loading="loading"
    :not-found="notFound"
    empty-title="No record of this piper"
    empty-description="This piper profile doesn’t exist or has no appearances."
  >
    <template #actions>
      <FavoriteButton
        v-if="isInfo"
        :id="piperId"
        type="pipers"
        :name="displayName"
        class="hover:bg-card-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
      />
    </template>
  </EntityLayout>
</template>
