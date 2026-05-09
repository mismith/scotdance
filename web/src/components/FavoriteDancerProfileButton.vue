<script setup lang="ts">
import { computed } from 'vue'
import { Star } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import type { DancerAppearance } from '@/composables/useDancerProfile'

const props = defineProps<{
  appearances: DancerAppearance[]
  name: string
}>()

const auth = useAuthStore()
const favorites = useFavoritesStore()

const dancerIds = computed(() => props.appearances.map((a) => a.hit.id))

const isFavorite = computed(() =>
  dancerIds.value.some((id) => favorites.isFavoriteDancer(id)),
)

async function applyAll(on: boolean) {
  await Promise.all(
    dancerIds.value.map((id) => favorites.setDancer(id, on, props.name)),
  )
}

async function handleClick() {
  if (!dancerIds.value.length) return
  const next = !isFavorite.value
  if (!auth.isSignedIn) {
    auth.enqueueAfterLogin(() => applyAll(next))
    auth.openLogin()
    return
  }
  await applyAll(next)
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
    aria-label="Favourite"
    :disabled="!dancerIds.length"
    :class="[
      'rounded-md p-2 transition-colors',
      isFavorite && 'text-secondary',
    ]"
    @click="handleClick"
  >
    <Star :class="['size-5', isFavorite && 'fill-current']" />
  </button>
</template>
