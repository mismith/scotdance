<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import { selectionHaptic } from '@/lib/haptics'
import { DANCER_COLORS, inkOn, isCustomColor, useDancerColorsStore, type DancerColor } from '@/stores/dancerColors'

// Choose the colour a followed dancer wears across your app: their bar on
// Home, their initials in lists, their number card band. Just for you. Lives
// in the Following menu on their page. The rainbow dot at the end opens the
// system colour picker for any colour at all. Two rows of five keep each dot
// a full 44px tap target in the 18rem menu.
const props = defineProps<{ dancerId: string; dancerName: string }>()

const RAINBOW = 'conic-gradient(#e11d48, #f59e0b, #eab308, #16a34a, #0891b2, #2563eb, #7c3aed, #db2777, #e11d48)'

const following = useFollowing()
const colors = useDancerColorsStore()
const first = computed(() => props.dancerName.split(' ')[0] || 'this dancer')
const current = computed(() => following.colorIdFor(props.dancerId))
const custom = computed(() => (isCustomColor(current.value) ? current.value : null))

// The system picker opens on their colour now, palette or not.
const seed = computed(() => {
  if (custom.value) return custom.value
  const hex = current.value && getComputedStyle(document.documentElement).getPropertyValue(`--${current.value}`).trim()
  return isCustomColor(hex) ? hex : '#b0102c'
})

function pick(c: DancerColor) {
  if (c !== current.value) selectionHaptic()
  colors.choose(props.dancerId, c)
}

function pickCustom(e: Event) {
  const hex = (e.target as HTMLInputElement).value.toLowerCase()
  if (isCustomColor(hex)) pick(hex)
}
</script>

<template>
  <div v-if="following.isFollowing(dancerId)" class="space-y-2.5">
    <p class="text-muted-foreground text-sm">{{ first }}’s colour, just for you</p>
    <div class="grid grid-cols-5 gap-2" role="radiogroup" :aria-label="`${first}’s colour`">
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
        <Check v-if="current === c.id" class="size-5" stroke-width="3" aria-hidden="true" />
      </button>
      <!-- The input covers the dot, so a tap lands on it directly (the most
           reliable way to open the picker in iOS and Android WebViews). -->
      <label
        :class="[
          'press has-focus-visible:outline-ring relative flex aspect-square items-center justify-center rounded-full has-focus-visible:outline-3 has-focus-visible:outline-offset-2',
          custom && 'ring-foreground ring-offset-raised ring-2 ring-offset-2',
        ]"
        :style="{ background: RAINBOW }"
        title="Any colour"
      >
        <span
          v-if="custom"
          class="text-on-dancer absolute inset-1 flex items-center justify-center rounded-full"
          :style="{ background: custom, '--on-dancer': inkOn(custom) }"
        >
          <Check class="size-5" stroke-width="3" aria-hidden="true" />
        </span>
        <input
          type="color"
          :value="seed"
          :aria-label="custom ? 'Any colour, chosen' : 'Any colour'"
          class="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
          @change="pickCustom"
        />
      </label>
    </div>
  </div>
</template>
