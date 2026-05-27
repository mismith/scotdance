<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import { Info, Trophy } from '@lucide/vue'
import EntityLayout from '@/components/EntityLayout.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { provideDancerProfile } from '@/composables/useDancerProfile'
import { useFavoritesStore } from '@/stores/favorites'
import { initialsOf } from '@/lib/format'
import { useVtScope } from '@/lib/viewTransitionFocus'

const tabs = [
  { name: 'Info', to: 'dancer.info', icon: Info },
  { name: 'Results', to: 'dancer.results', icon: Trophy },
]

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

useVtScope('dancer').syncFocus(dancerId)

const { displayName, image, loading, notFound } = provideDancerProfile(toRef(dancerId))

const favorites = useFavoritesStore()
const initials = computed(() => initialsOf(displayName.value))
const isFavorite = computed(() => favorites.isFavorite('dancers', dancerId.value))
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
    :image="image"
    :initials="initials"
    :is-favorite="isFavorite"
    :loading="loading"
    :not-found="notFound"
    :empty-title="`No record of ${displayName}`"
    empty-description="We couldn’t find this dancer across the competitions we know about."
    :tabs="tabs"
  >
    <template #actions>
      <FavoriteButton
        v-if="isInfo"
        :id="dancerId"
        type="dancers"
        :name="displayName"
        class="hover:bg-card-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
      />
    </template>
  </EntityLayout>
</template>
