<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import { DANCER_COLORS, useDancerColorsStore, type DancerColorId } from '@/stores/dancerColors'

// Choose the colour a followed dancer wears across your app: their bar on
// Home, their dot in lists, their number card band. Just for you.
const props = defineProps<{ dancerId: string; dancerName: string }>()

const following = useFollowing()
const colors = useDancerColorsStore()
const first = computed(() => props.dancerName.split(' ')[0] || 'this dancer')
const current = computed(() => following.colorIdFor(props.dancerId))

function pick(id: DancerColorId) {
  colors.choose(props.dancerId, id)
}
</script>

<template>
  <section v-if="following.isFollowing(dancerId)" class="space-y-2">
    <h2 class="text-heading pt-1">{{ first }}’s colour</h2>
    <div class="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
      <div class="grid grid-cols-8 gap-2" role="radiogroup" :aria-label="`${first}’s colour`">
        <button
          v-for="c in DANCER_COLORS"
          :key="c.id"
          type="button"
          role="radio"
          :aria-checked="current === c.id"
          :aria-label="c.label"
          :title="c.label"
          class="flex aspect-square items-center justify-center rounded-full text-white"
          :class="current === c.id && 'ring-foreground ring-offset-card ring-2 ring-offset-2'"
          :style="{ background: `var(--${c.id})` }"
          @click="pick(c.id)"
        >
          <Check v-if="current === c.id" class="size-4" stroke-width="3" />
        </button>
      </div>
      <p class="text-muted-foreground text-sm">How {{ first }} shows up across ScotDance for you.</p>
    </div>
  </section>
</template>
