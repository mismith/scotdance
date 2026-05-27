<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Star } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore, type FavoriteType } from '@/stores/favorites'

const props = defineProps<{
  type: FavoriteType
  id: string
  /** Denormed display name stored alongside the favourite — lets list pages
   *  show favourites before the slim index for that entity loads. */
  name?: string
}>()

const auth = useAuthStore()
const favorites = useFavoritesStore()

const isFavorite = computed(() => favorites.isFavorite(props.type, props.id))
const animating = ref(false)

async function handleClick(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  if (!auth.isSignedIn) {
    auth.enqueueAfterLogin(() =>
      favorites.setFavorite(props.type, props.id, true, props.name),
    )
    auth.openLogin()
    return
  }
  await favorites.toggle(props.type, props.id, props.name)
  // Re-arm so a rapid second click restarts the animation from frame 0.
  animating.value = false
  await nextTick()
  animating.value = true
}
</script>

<template>
  <button
    v-tap-feedback
    type="button"
    :title="
      auth.isSignedIn
        ? isFavorite
          ? 'Unfavourite'
          : 'Favourite'
        : 'Sign in to favourite'
    "
    aria-label="Favourite"
    :class="[
      'hover:bg-accent flex size-11 items-center justify-center rounded-full transition-colors',
      isFavorite ? 'text-secondary' : 'opacity-70 hover:opacity-100',
    ]"
    @click="handleClick"
  >
    <Star
      :class="[
        'size-5',
        isFavorite && 'fill-current',
        animating && 'animate-pop',
      ]"
      @animationend="animating = false"
    />
  </button>
</template>
