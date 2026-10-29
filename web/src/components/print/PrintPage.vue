<script setup lang="ts">
import { computed } from 'vue'
import PrintUnit from '@/components/print/PrintUnit.vue'
import { FOOTER, MARGIN, PAPER, PRINT_FONT, contentBox, type Paper, type Unit } from '@/lib/print/model'

// One sheet of paper at its real size (the preview zooms it), with its page
// number at the foot if they're on. A sideways page turns its units a
// quarter turn left, to read from the side, as wide platform grids are
// printed; its number stays upright.

const props = defineProps<{
  units: Unit[]
  paper: Paper
  number: number
  /** Its page number shown at the foot. */
  numbered?: boolean
}>()

const size = computed(() => PAPER[props.paper])
const fullPage = computed(() => props.units.length === 1 && props.units[0].fullPage)
const sideways = computed(() => !!props.units[0]?.rotate)
const box = computed(() => contentBox(props.paper, true, props.numbered))
</script>

<template>
  <div
    data-print-page
    class="flex flex-col overflow-hidden bg-white text-[10pt] leading-[1.3] text-[#15181c] [print-color-adjust:exact] break-after-page last:break-after-auto"
    :style="{ width: `${size.width}px`, height: `${size.height}px`, padding: `${MARGIN}px`, fontFamily: PRINT_FONT }"
  >
    <div v-if="sideways" class="relative min-h-0 flex-1">
      <div
        class="absolute top-0 left-0 origin-top-left"
        :style="{ width: `${box.width}px`, height: `${box.height}px`, transform: `translateY(${box.width}px) rotate(-90deg)` }"
      >
        <PrintUnit v-for="u in units" :key="u.key" :unit="u" />
      </div>
    </div>
    <div v-else class="min-h-0 flex-1">
      <PrintUnit v-for="u in units" :key="u.key" :unit="u" />
    </div>
    <footer v-if="numbered && !fullPage" class="flex shrink-0 items-end justify-center text-[9pt] text-[#50575f] tabular-nums" :style="{ height: `${FOOTER}px` }">
      {{ number }}
    </footer>
  </div>
</template>
