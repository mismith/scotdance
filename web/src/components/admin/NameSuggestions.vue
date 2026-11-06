<script setup lang="ts">
import { draftName } from '@/lib/admin/teamMembers'
import type { NameSuggestion } from '@/lib/admin/nameSuggestions'

// The names dancing here that fit what's typed, over the form just under the
// box (DancersField), so nothing below moves as they come and go.
// Pressing one mustn't take focus from the box first (that closes them).

defineProps<{
  id: string
  suggestions: NameSuggestion[]
  /** The highlighted one, by arrow keys. */
  active: number
}>()
defineEmits<{ pick: [suggestion: NameSuggestion] }>()
</script>

<template>
  <ul :id="id" role="listbox" aria-label="Dancing here" class="frosted-paper menu-edge absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl p-1" @mousedown.prevent>
    <li v-for="(s, k) in suggestions" :id="`${id}-${k}`" :key="`${s.firstName} ${s.lastName}`" role="option" :aria-selected="k === active">
      <button
        type="button"
        tabindex="-1"
        :class="['press-row flex min-h-11 w-full flex-col justify-center rounded-xl px-3 py-1.5 text-left', k === active && '[--row-tint:var(--tint-hover)]']"
        @click="$emit('pick', s)"
      >
        <span class="truncate text-base font-medium">{{ draftName(s) }}</span>
        <span class="text-muted-foreground truncate text-sm">{{ s.line }}</span>
      </button>
    </li>
  </ul>
</template>
