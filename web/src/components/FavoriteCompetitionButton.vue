<script setup lang="ts">
import { computed } from 'vue'
import { Pin } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'

const props = defineProps<{
  competitionId: string
  size?: 'sm' | 'md'
}>()

const auth = useAuthStore()
const favorites = useFavoritesStore()

const isPinned = computed(() => favorites.isFavoriteCompetition(props.competitionId))
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
    :title="auth.isSignedIn ? (isPinned ? 'Unpin' : 'Pin') : 'Sign in to pin'"
    :class="[
      'hover:bg-accent rounded-md p-2 transition-colors',
      isPinned ? 'text-secondary' : 'text-muted-foreground hover:text-foreground',
    ]"
    @click="handleClick"
  >
    <Pin :class="[sizeClass, isPinned && 'fill-current']" />
  </button>
</template>
