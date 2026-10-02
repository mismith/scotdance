<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { hideNativeSplash, isNative } from '@/lib/native'
import { ARRIVE, CX, CYCLE, GROUND, HEAD_R, HOME, WIDTH, pose } from '@/lib/scott'

// The native apps' launch: Scott's split leap, coming to rest as the logo
// (lib/scott). The native splash is plain background, so he simply fades in,
// already pushing off from a plié. Still loading a while after he's landed,
// he leaps again (a little treat for slow starts); once the app is ready he
// fades out, finishing a leap first. Native only (or `?splash` in
// development). With Reduce Motion he just stands there as the logo. Colours
// follow the system appearance, as the native splash does, not the app's
// own theme setting.
const FADE_IN = 0.2
const FIRST_LEAP = 1.6 // s as the logo before another leap, while still loading
const AGAIN = 3.2
const OUT = 0.3

const router = useRouter()
const show = ref(isNative || (import.meta.env.DEV && new URLSearchParams(location.search).has('splash')))
const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const c = ref(reduce ? 0 : ARRIVE)
const opacity = ref(reduce ? 1 : 0)
const out = ref(0)
const p = computed(() => pose(c.value))

// Framed on the logo (its middle at the centre), with room below for the floor.
const MID = HOME - 50
const HEIGHT = 2 * (GROUND + 40 - MID)
const viewBox = `-20 ${MID - HEIGHT / 2} 552 ${HEIGHT}`
const at = (q: { x: number; y: number }) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`

const clamp = (t: number) => Math.min(1, Math.max(0, t))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

let raf = 0
onMounted(async () => {
  if (!show.value) return
  // Two frames: this overlay is on screen before the native splash goes.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  hideNativeSplash()
  if (reduce) {
    await router.isReady()
    show.value = false
    return
  }
  let ready = false
  void router.isReady().then(() => (ready = true))
  const start = performance.now()
  let leapAt: number | null = -ARRIVE
  let next = Infinity
  let outAt: number | null = null
  const tick = (now: number) => {
    const t = (now - start) / 1000
    let cc = 0
    if (leapAt != null) {
      cc = t - leapAt
      if (cc >= CYCLE) {
        cc = 0
        next = t + (next === Infinity ? FIRST_LEAP : AGAIN)
        leapAt = null
      }
    }
    if (leapAt == null && !ready && t >= next) leapAt = t
    if (ready && outAt == null && leapAt == null) outAt = t
    c.value = cc
    out.value = outAt == null ? 0 : clamp((t - outAt) / OUT)
    opacity.value = Math.min(easeOut(clamp(t / FADE_IN)), 1 - easeInOut(out.value))
    if (out.value >= 1) show.value = false
    else raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))

// Out: a touch larger as he fades.
const transform = computed(() => {
  const s = 1 + 0.05 * easeOut(out.value)
  return `translate(${CX} ${MID}) scale(${s}) translate(${-CX} ${-MID})`
})
</script>

<template>
  <div
    v-if="show"
    aria-hidden="true"
    :class="[
      'fixed inset-0 z-[100] grid place-items-center bg-[#f2f4f7] text-[#0065bd]',
      '[@media(prefers-color-scheme:dark)]:bg-[#0c0f13] [@media(prefers-color-scheme:dark)]:text-[#62aaf0]',
    ]"
  >
    <svg :viewBox="viewBox" overflow="visible" class="w-[min(46vw,15rem)]" :style="{ opacity }">
      <!-- The floor, only near it. -->
      <ellipse
        :cx="CX"
        :cy="GROUND + 14"
        :rx="40 + 60 * p.nearFloor"
        ry="14"
        :opacity="p.nearFloor ** 2"
        class="fill-[rgb(16_24_40/0.14)] [@media(prefers-color-scheme:dark)]:fill-[rgb(0_0_0/0.55)]"
      />
      <g :transform="transform" fill="currentColor">
        <g fill="none" stroke="currentColor" :stroke-width="WIDTH" stroke-linejoin="round">
          <polyline v-for="(l, i) in p.legs" :key="`l${i}`" :points="`${at(p.hip)} ${at(l.knee)} ${at(l.foot)}`" />
          <polyline v-for="(h, i) in p.hands" :key="`a${i}`" :points="`${at(p.hip)} ${at(h)}`" />
        </g>
        <circle :cx="p.hip.x" :cy="p.hip.y" :r="WIDTH / 2 + 4" />
        <circle :cx="p.head.x" :cy="p.head.y" :r="HEAD_R" />
      </g>
    </svg>
  </div>
</template>
