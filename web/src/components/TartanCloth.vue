<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { bandsAlong, repeatIndex, runsOf, stripeAt, threadsIn, weave, type Hex, type Role, type Stripe } from '@/lib/tartan'

// The loom's cloth: a stretch of the tartan, a repeat and a half across, at
// whatever size it's given. Tap it to choose the stripe under your finger
// (of the two stripes crossing there, the narrower: that's the one aimed
// at). The chosen stripe stays lit both ways and the rest of the cloth dims,
// so you can see every place it lands.
const props = defineProps<{ stripes: Stripe[]; palette: Record<Role, Hex>; selected: number | null }>()
const emit = defineEmits<{ select: [index: number] }>()

const REPEATS = 1.5
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const { width, height } = useElementSize(canvas)

function draw() {
  const el = canvas.value
  if (!el || !width.value || !props.stripes.length) return
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const w = (el.width = Math.round(width.value * dpr))
  const h = (el.height = Math.round(height.value * dpr))
  const ctx = el.getContext('2d')
  if (!ctx) return
  const runs = runsOf(props.stripes, props.palette)
  const k = w / (threadsIn(props.stripes) * REPEATS)
  weave(ctx, w, h, runs, k)
  if (props.selected == null) return
  // Dim everything outside the chosen stripe's bands, across and down.
  const order = repeatIndex(props.stripes.length)
  const unlit = (length: number) => {
    const out: Array<[number, number]> = []
    let x = 0
    bandsAlong(runs, k, length, (_, a, b, j) => {
      if (order[j] !== props.selected) return
      if (a > x) out.push([x, a])
      x = Math.max(x, b)
    })
    if (x < length) out.push([x, length])
    return out
  }
  const across = unlit(w)
  const down = unlit(h)
  ctx.fillStyle = 'rgb(8 10 14 / 0.58)'
  for (const [x0, x1] of across) for (const [y0, y1] of down) ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
}

watch([() => props.stripes, () => props.palette, () => props.selected, width, height], draw, { flush: 'post', deep: true })

function onClick(e: MouseEvent) {
  const el = canvas.value
  if (!el || !props.stripes.length) return
  const r = el.getBoundingClientRect()
  const k = r.width / (threadsIn(props.stripes) * REPEATS)
  const x = stripeAt(props.stripes, (e.clientX - r.left) / k)
  const y = stripeAt(props.stripes, (e.clientY - r.top) / k)
  emit('select', y.width < x.width ? y.index : x.index)
}
</script>

<template>
  <!-- (The stripes are chosen from the bricks above too, so the cloth itself
       is a picture to screen readers.) -->
  <canvas
    ref="canvas"
    role="img"
    aria-label="The tartan"
    class="block aspect-square max-h-[min(22rem,46svh)] w-full cursor-pointer rounded-2xl outline-1 -outline-offset-1 outline-black/10"
    @click="onClick"
  />
</template>
