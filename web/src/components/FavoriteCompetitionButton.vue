<script setup lang="ts">
import { computed } from 'vue'
import { Star } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'

const props = defineProps<{
  competitionId: string
  size?: 'sm' | 'md'
}>()

const auth = useAuthStore()
const favorites = useFavoritesStore()

const isFavorite = computed(() => favorites.isFavoriteCompetition(props.competitionId))
const sizeClass = computed(() => (props.size === 'md' ? 'size-5' : 'size-4'))

async function handleClick(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  if (!auth.isSignedIn) {
    auth.enqueueAfterLogin(() => favorites.setCompetition(props.competitionId, true))
    auth.openLogin()
    return
  }
  await favorites.toggleCompetition(props.competitionId)
}
</script>

<template>
  <button
    type="button"
    :title="
      auth.isSignedIn
        ? isFavorite
          ? 'Unfavourite'
          : 'Favourite'
        : 'Sign in to favourite'
    "
    :class="[
      'hover:bg-accent rounded-md p-2 transition-colors',
      isFavorite ? 'text-secondary' : 'opacity-70 hover:opacity-100',
    ]"
    @click="handleClick"
  >
    <Star :class="[sizeClass, isFavorite && 'fill-current']" />
  </button>
</template>
