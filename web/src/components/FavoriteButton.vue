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
  /** Show the word ("Follow" / "Following") next to the star. */
  labelled?: boolean
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
    auth.openLogin({ reason: 'favorite', name: props.name })
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
    :aria-pressed="isFavorite"
    :aria-label="labelled ? undefined : `${isFavorite ? 'Following' : 'Follow'}${name ? ` ${name}` : ''}`"
    :class="[
      'flex shrink-0 items-center justify-center rounded-full transition-colors',
      labelled
        ? [
            'h-11 gap-1.5 border px-4 text-[0.9375rem] font-bold',
            isFavorite ? 'bg-blue-paper text-primary border-transparent' : 'bg-primary border-primary text-primary-foreground',
          ]
        : ['size-11 hover:bg-accent', isFavorite ? 'text-primary' : 'text-muted-foreground'],
    ]"
    @click="handleClick"
  >
    <Star
      :class="['size-5', isFavorite && 'fill-current', animating && 'animate-pop']"
      @animationend="animating = false"
    />
    <template v-if="labelled">{{ isFavorite ? 'Following' : 'Follow' }}</template>
  </button>
</template>
