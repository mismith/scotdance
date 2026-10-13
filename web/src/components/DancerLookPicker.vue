<script setup lang="ts">
import { computed } from 'vue'
import { Check, SlidersHorizontal } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import { selectionHaptic } from '@/lib/haptics'
import { PRESETS, clothImage, presetOf, recolor, weavePreset } from '@/lib/tartan'
import {
  DANCER_COLORS,
  inkFor,
  isCustomColor,
  isTartan,
  useDancerColorsStore,
  type DancerColor,
} from '@/stores/dancerColors'

// How a followed dancer looks across your app, just for you: a colour, then
// a pattern woven in it (Plain, or one of the presets), then Customise for
// the loom (TartanSheet). Colour and pattern are independent: a new colour
// keeps the pattern (repainting the stripes that were in the old colour), a
// new pattern keeps the colour. Both rows are five
// 44px circles across, so a pattern previews just what the avatar will wear.
// The rainbow dot opens the system colour picker for any colour at all.
const props = defineProps<{ dancerId: string; dancerName: string }>()
const emit = defineEmits<{ customise: [] }>()

const RAINBOW = 'conic-gradient(#e11d48, #f59e0b, #eab308, #16a34a, #0891b2, #2563eb, #7c3aed, #db2777, #e11d48)'
const RING = 'ring-foreground ring-offset-raised ring-2 ring-offset-2'

const following = useFollowing()
const colors = useDancerColorsStore()
const first = computed(() => props.dancerName.split(' ')[0] || 'this dancer')
const look = computed(() => following.lookFor(props.dancerId))
const current = computed(() => following.colorIdFor(props.dancerId))
const tartan = computed(() => (isTartan(look.value) ? look.value : null))
const custom = computed(() => (isCustomColor(current.value) ? current.value : null))
const preset = computed(() => (tartan.value ? presetOf(tartan.value) : null))
const own = computed(() => !!tartan.value && !preset.value)
const patternName = computed(() => (!tartan.value ? 'Plain' : (preset.value?.name ?? 'Your own')))

// The system picker opens on their colour now, palette or not.
const seed = computed(() => {
  if (custom.value) return custom.value
  const hex = current.value && getComputedStyle(document.documentElement).getPropertyValue(`--${current.value}`).trim()
  return isCustomColor(hex) ? hex : '#b0102c'
})

const plain = computed(() => (current.value ? (isCustomColor(current.value) ? current.value : `var(--${current.value})`) : 'var(--primary)'))
const patterns = computed(() =>
  PRESETS.map((p) => ({
    ...p,
    bg: current.value ? (clothImage(weavePreset(p.sett, current.value), 44) ?? plain.value) : plain.value,
  })),
)
const ownBg = computed(() => (tartan.value ? (clothImage(tartan.value, 28) ?? plain.value) : null))

function pickColor(c: DancerColor) {
  if (c === current.value) return
  selectionHaptic()
  colors.choose(props.dancerId, tartan.value ? recolor(tartan.value, c) : c)
}

function pickCustom(e: Event) {
  const hex = (e.target as HTMLInputElement).value.toLowerCase()
  if (isCustomColor(hex)) pickColor(hex)
}

function pickPattern(sett: string | null) {
  const c = current.value
  const already = sett ? preset.value?.sett === sett : !tartan.value
  if (!c || already) return
  selectionHaptic()
  colors.choose(props.dancerId, sett ? weavePreset(sett, c) : c)
}
</script>

<template>
  <div v-if="following.isFollowing(dancerId)" class="space-y-2.5 text-left">
    <p class="text-muted-foreground text-sm">{{ first }}’s look, just for you</p>
    <div class="grid grid-cols-5 gap-2" role="radiogroup" :aria-label="`${first}’s colour`">
      <button
        v-for="c in DANCER_COLORS"
        :key="c.id"
        type="button"
        role="radio"
        :aria-checked="current === c.id"
        :aria-label="c.label"
        :title="c.label"
        :class="['press flex aspect-square items-center justify-center rounded-full', current === c.id && RING]"
        :style="{ background: `var(--${c.id})`, color: inkFor(c.id) }"
        @click="pickColor(c.id)"
      >
        <Check v-if="current === c.id" class="size-5" stroke-width="3" aria-hidden="true" />
      </button>
      <!-- The input covers the dot, so a tap lands on it directly (the most
           reliable way to open the picker in iOS and Android WebViews). -->
      <label
        :class="[
          'press has-focus-visible:outline-ring relative flex aspect-square items-center justify-center rounded-full has-focus-visible:outline-3 has-focus-visible:outline-offset-2',
          custom && RING,
        ]"
        :style="{ background: RAINBOW }"
        title="Any colour"
      >
        <span
          v-if="custom"
          class="absolute inset-1 flex items-center justify-center rounded-full"
          :style="{ background: custom, color: inkFor(custom) }"
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

    <p class="flex items-baseline justify-between pt-2 text-sm">
      <span class="font-semibold">Pattern</span>
      <span class="text-muted-foreground">{{ patternName }}</span>
    </p>
    <div class="grid grid-cols-5 gap-2" role="radiogroup" :aria-label="`${first}’s pattern`">
      <button
        type="button"
        role="radio"
        :aria-checked="!tartan"
        aria-label="Plain"
        title="Plain"
        :class="['press aspect-square rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]', !tartan && RING]"
        :style="{ background: plain }"
        @click="pickPattern(null)"
      />
      <button
        v-for="p in patterns"
        :key="p.id"
        type="button"
        role="radio"
        :aria-checked="preset?.sett === p.sett"
        :aria-label="p.name"
        :title="p.name"
        :class="['press aspect-square rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]', preset?.sett === p.sett && RING]"
        :style="{ background: p.bg }"
        @click="pickPattern(p.sett)"
      />
    </div>

    <!-- The loom. Once you've made your own, it's here, ringed like any choice. -->
    <button
      type="button"
      :aria-pressed="own"
      class="press focus-inset mt-1.5 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] text-base font-semibold"
      @click="emit('customise')"
    >
      <span
        v-if="own && ownBg"
        :class="['size-6 shrink-0 rounded-full', RING, 'ring-offset-1']"
        :style="{ background: ownBg }"
        aria-hidden="true"
      />
      <SlidersHorizontal v-else class="size-5" aria-hidden="true" />
      Customise
    </button>
  </div>
</template>
