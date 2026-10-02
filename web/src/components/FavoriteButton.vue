<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Star } from '@lucide/vue'
import { followHaptic } from '@/lib/haptics'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore, type FavoriteType } from '@/stores/favorites'

// Follow a competition, judge, piper or venue: the star (filled red once
// you follow, the one mark for following), or with `labelled` a quiet tonal
// pill that says so.
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
  const was = isFavorite.value
  await favorites.toggle(props.type, props.id, props.name)
  // A small lift and a firm tap for following; nothing for unfollowing.
  if (was) return
  followHaptic()
  animating.value = false
  await nextTick()
  animating.value = true
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="isFavorite"
    :aria-label="labelled ? undefined : `${isFavorite ? 'Following' : 'Follow'}${name ? ` ${name}` : ''}`"
    :class="[
      'press flex shrink-0 items-center justify-center rounded-full transition-colors',
      labelled
        ? ['h-11 gap-1.5 px-4 text-callout font-semibold', isFavorite ? 'surface text-foreground' : 'bg-blue-paper text-primary']
        : ['size-11', isFavorite ? 'text-secondary' : 'text-muted-foreground'],
    ]"
    @click="handleClick"
  >
    <Star
      :class="[
        'size-5',
        isFavorite && 'text-secondary fill-current',
        animating && 'motion-safe:animate-pop',
      ]"
      aria-hidden="true"
      @animationend="animating = false"
    />
    <template v-if="labelled">{{ isFavorite ? 'Following' : 'Follow' }}</template>
  </button>
</template>
