<script setup lang="ts">
import { CX, FRAME, HEAD_R, LOGO, WIDTH, pose } from '@/lib/scott'

// The ScotDance mark: a Highland dancer mid split leap (Scott, lib/scott),
// arms up and legs out, square-cut hands and feet, a dot for his head. Drawn
// in currentColor, so it can be a watermark, an icon or a badge. `framed`
// places him as on the app icon, for a square tile behind him; otherwise he
// sits in the middle of the mark's 512 box.
const props = defineProps<{ framed?: boolean }>()

const p = pose(0)
const limbs = [...p.hands, ...p.legs.map((l) => l.foot)].map((q) => ({ x1: p.hip.x, y1: p.hip.y, x2: q.x, y2: q.y }))
const size = props.framed ? (LOGO.right - LOGO.left) / FRAME.square.width : 512
const cy = props.framed ? FRAME.square.centre : (LOGO.top + LOGO.bottom) / 2
const viewBox = `${CX - size / 2} ${cy - size / 2} ${size} ${size}`
</script>

<template>
  <svg :viewBox="viewBox" aria-hidden="true" fill="currentColor">
    <g stroke="currentColor" :stroke-width="WIDTH">
      <line v-for="(l, i) in limbs" :key="i" v-bind="l" />
    </g>
    <circle :cx="p.hip.x" :cy="p.hip.y" :r="WIDTH / 2 + 4" />
    <circle :cx="p.head.x" :cy="p.head.y" :r="HEAD_R" />
  </svg>
</template>
