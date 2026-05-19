<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import FavoriteDancerProfileButton from '@/components/FavoriteDancerProfileButton.vue'
import { provideDancerProfile } from '@/composables/useDancerProfile'
import { useFavoritesStore } from '@/stores/favorites'
import { initialsOf } from '@/lib/format'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

useVtScope('dancer').syncFocus(dancerId)

const { displayName, location, image, appearances, loading, notFound } =
  provideDancerProfile(toRef(dancerId))

const favorites = useFavoritesStore()
const initials = computed(() => initialsOf(displayName.value))
const isFavorite = computed(() =>
  appearances.value.some(
    (a) => a.raw.dancerId && favorites.isFavoriteDancer(a.raw.dancerId),
  ),
)
const isInfo = computed(() => String(route.name ?? '') === 'dancer.info')
</script>

<template>
  <EntityLayout
    :id="dancerId"
    scope="dancer"
    id-param="dancerId"
    route-prefix="dancer"
    section-route-name="dancers"
    :display-name="displayName"
    :subtitle="location"
    :image="image"
    :initials="initials"
    :is-favorite="isFavorite"
    :loading="loading"
    :not-found="notFound"
    :empty-title="`No record of ${displayName}`"
    empty-description="We couldn’t find this dancer across the competitions we know about."
    results-tab-label="Results"
  >
    <template #actions>
      <FavoriteDancerProfileButton
        v-if="isInfo"
        :appearances="appearances"
        :name="displayName"
        class="hover:bg-card-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
      />
    </template>
  </EntityLayout>
</template>
