<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import { selectionHaptic } from '@/lib/haptics'
import { DANCER_COLORS, useDancerColorsStore, type DancerColorId } from '@/stores/dancerColors'

// Choose the colour a followed dancer wears across your app: their bar on
// Home, their initials in lists, their number card band. Just for you. Lives
// in the Following menu on their page.
const props = defineProps<{ dancerId: string; dancerName: string }>()

const following = useFollowing()
const colors = useDancerColorsStore()
const first = computed(() => props.dancerName.split(' ')[0] || 'this dancer')
const current = computed(() => following.colorIdFor(props.dancerId))

function pick(id: DancerColorId) {
  if (id !== current.value) selectionHaptic()
  colors.choose(props.dancerId, id)
}
</script>

<template>
  <div v-if="following.isFollowing(dancerId)" class="space-y-2.5">
    <p class="text-muted-foreground text-sm">{{ first }}’s colour, just for you</p>
    <div class="grid grid-cols-8 gap-1.5" role="radiogroup" :aria-label="`${first}’s colour`">
      <button
        v-for="c in DANCER_COLORS"
        :key="c.id"
        type="button"
        role="radio"
        :aria-checked="current === c.id"
        :aria-label="c.label"
        :title="c.label"
        :class="[
          'press text-on-dancer flex aspect-square items-center justify-center rounded-full',
          current === c.id && 'ring-foreground ring-offset-raised ring-2 ring-offset-2',
        ]"
        :style="{ background: `var(--${c.id})` }"
        @click="pick(c.id)"
      >
        <Check v-if="current === c.id" class="size-3.5" stroke-width="3" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
