<script setup lang="ts">
import { VISIBILITY, type Visibility } from '@/lib/visibility'

// How a competition is hidden from everyone else, shown to its admins
// wherever it's listed (`useHiddenAs` says which): solid ink for Private (no
// one else sees it at all), outlined for Unpublished (its overview only).
// Nothing once it's published, so no chip means everyone can see it.
defineProps<{ visibility: Exclude<Visibility, 'published'> | null }>()
</script>

<template>
  <span
    v-if="visibility"
    :class="[
      'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold',
      visibility === 'private'
        ? 'bg-foreground text-background'
        : 'border-foreground/40 text-foreground border',
    ]"
  >
    <component :is="VISIBILITY[visibility].icon" class="size-3.5" aria-hidden="true" />
    {{ VISIBILITY[visibility].label
    }}<span class="sr-only">: {{ VISIBILITY[visibility].line }}</span>
  </span>
</template>
