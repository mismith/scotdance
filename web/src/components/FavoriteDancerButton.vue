<script setup lang="ts">
import { computed } from 'vue';
import { Star } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useFavoritesStore } from '@/stores/favorites';
import type { Dancer } from '@/types/competition';
import { dancerFullName } from '@/types/competition';

const props = defineProps<{
  dancer: Pick<Dancer, 'id' | 'firstName' | 'lastName'>;
  size?: 'sm' | 'md';
}>();

const auth = useAuthStore();
const favorites = useFavoritesStore();

const isFavorite = computed(() => favorites.isFavoriteDancer(props.dancer.id));

const sizeClass = computed(() => (props.size === 'md' ? 'size-5' : 'size-4'));

async function handleClick(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  if (!auth.isSignedIn) {
    await auth.signInWithGoogle();
    if (!auth.isSignedIn) return;
  }
  await favorites.toggleDancer(props.dancer.id, dancerFullName(props.dancer));
}
</script>

<template>
  <button
    type="button"
    @click="handleClick"
    :title="auth.isSignedIn ? (isFavorite ? 'Unfavorite' : 'Favorite') : 'Sign in to favorite'"
    :class="[
      'p-2 rounded-md hover:bg-accent transition-colors',
      isFavorite ? 'text-yellow-500' : 'text-muted-foreground hover:text-foreground',
    ]"
  >
    <Star :class="[sizeClass, isFavorite && 'fill-current']" />
  </button>
</template>
