<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { DANCE_KINDS, KIND_COLORS, KIND_NAMES, type DanceKind } from '@/lib/danceKinds'
import type { Wheel, WheelDance } from '@/lib/danceWheel'
import { STANDARD_DANCES } from '@/lib/standardDances'

// The dancer saltire: a dancer's dances in a circle. A bold X (a saltire,
// as thick as the logo's limbs)
// splits it into four fixed quarters, one per kind of dance (Highland always
// at the top), so an empty quarter shows what's not been tried yet. A kind
// danced more fills more of its quarter; each dance reaches further out the
// better it goes, against the dancer's own best dance. The fine twill beyond
// is room to grow. Tap a quarter and its dances sweep round to fill the
// circle; the X in the middle closes it.
const props = defineProps<{ wheel: Wheel }>()

const R0 = 30 // the hub
const IN = R0 + 8 // where slices start
const R = 112 // full reach
const QUARTER = (76 * Math.PI) / 180
const uid = useId()

const open = ref<DanceKind | null>(null)
const picked = ref<string | null>(null)

const point = (a: number, r: number) => `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`
/** A ring slice, clockwise from 12 o'clock. */
function sector(a0: number, a1: number, r0: number, r1: number, pad = 0.012) {
  if (a1 - a0 >= 2 * Math.PI - 1e-6) {
    return `M${point(0, r1)} A${r1} ${r1} 0 1 1 ${point(Math.PI, r1)} A${r1} ${r1} 0 1 1 ${point(0, r1)} M${point(0, r0)} A${r0} ${r0} 0 1 0 ${point(Math.PI, r0)} A${r0} ${r0} 0 1 0 ${point(0, r0)} Z`
  }
  const s = a0 + Math.min(pad, (a1 - a0) / 4)
  const e = a1 - Math.min(pad, (a1 - a0) / 4)
  const large = e - s > Math.PI ? 1 : 0
  return `M${point(s, r1)} A${r1} ${r1} 0 ${large} 1 ${point(e, r1)} L${point(e, r0)} A${r0} ${r0} 0 ${large} 0 ${point(s, r0)} Z`
}

// Short names on the wheel where the standard list has a word for one ("Fling"), not initials ("PDB").
const SHORT = new Map(STANDARD_DANCES.filter((d) => d.shortName && /[a-z]/.test(d.shortName)).map((d) => [d.name, d.shortName!]))
const shortName = (name: string) => SHORT.get(name) ?? name

interface Slice {
  kind: DanceKind
  dance: WheelDance
  a0: number
  a1: number
  r: number
}

const total = computed(() => props.wheel.kinds.reduce((n, k) => n + k.times, 0))
const target = computed<Slice[]>(() => {
  const kinds = props.wheel.kinds
  if (open.value) {
    const k = kinds.find((x) => x.kind === open.value)
    if (!k) return []
    const best = Math.max(...k.dances.map((d) => d.score), 1e-6)
    let a = 0
    return k.dances.map((dance) => {
      const a0 = a
      a += (dance.times / k.times) * 2 * Math.PI
      return { kind: k.kind, dance, a0, a1: a, r: IN + (R - IN) * Math.max(0.08, dance.score / best) }
    })
  }
  const most = Math.max(...kinds.map((k) => k.times))
  const best = Math.max(...kinds.flatMap((k) => k.dances.map((d) => d.score)), 1e-6)
  const out: Slice[] = []
  for (const k of kinds) {
    // The most danced kind fills its quarter; the rest are narrower fans.
    const span = QUARTER * Math.max(0.22, k.times / most)
    let a = DANCE_KINDS.indexOf(k.kind) * (Math.PI / 2) - span / 2
    for (const dance of k.dances) {
      const a0 = a
      a += (dance.times / k.times) * span
      out.push({ kind: k.kind, dance, a0, a1: a, r: IN + (R - IN) * Math.max(0.08, dance.score / best) })
    }
  }
  return out
})

// What's drawn: the target, eased to from wherever it was. Slices that
// arrive grow out of the hub at their own spot; ones that go shrink back in.
interface Shape {
  key: string
  kind: DanceKind
  name: string
  a0: number
  a1: number
  r: number
  o: number
}
const DURATION = 520
const keyOf = (s: Slice) => `${s.kind}:${s.dance.name}`
const shapeOf = (s: Slice): Shape => ({ key: keyOf(s), kind: s.kind, name: s.dance.name, a0: s.a0, a1: s.a1, r: s.r, o: 1 })
const tucked = (s: Shape): Shape => {
  const mid = (s.a0 + s.a1) / 2
  return { ...s, a0: mid, a1: mid, r: IN, o: 0 }
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const mix = (a: Shape, b: Shape, t: number): Shape => ({
  ...b,
  a0: a.a0 + (b.a0 - a.a0) * t,
  a1: a.a1 + (b.a1 - a.a1) * t,
  r: a.r + (b.r - a.r) * t,
  o: a.o + (b.o - a.o) * t,
})
const drawn = ref<Shape[]>([])
const moving = ref(false)
let frame = 0
watch(
  target,
  (next) => {
    const to = next.map(shapeOf)
    cancelAnimationFrame(frame)
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!drawn.value.length || reduce) {
      drawn.value = to
      return
    }
    const from = new Map(drawn.value.map((s) => [s.key, s]))
    const into = new Map(to.map((s) => [s.key, s]))
    const pairs = [...new Set([...from.keys(), ...into.keys()])].map((k) => {
      const a = from.get(k)
      const b = into.get(k)
      return [a ?? tucked(b!), b ?? tucked(a!)] as const
    })
    const start = performance.now()
    moving.value = true
    const step = (now: number) => {
      const t = ease(Math.min(1, (now - start) / DURATION))
      drawn.value = pairs.map(([a, b]) => mix(a, b, t))
      if (t < 1) frame = requestAnimationFrame(step)
      else {
        drawn.value = to
        moving.value = false
      }
    }
    frame = requestAnimationFrame(step)
  },
  { immediate: true },
)
onBeforeUnmount(() => cancelAnimationFrame(frame))

const hits = computed(() => {
  if (open.value)
    return target.value.map((s) => ({
      key: s.dance.name,
      d: sector(s.a0, s.a1, R0, R + 22, 0),
      label: `${s.dance.name}: danced ${s.dance.times} times, placed ${s.dance.placed}`,
      tap: () => tap(s),
    }))
  return props.wheel.kinds.map((k) => {
    const mid = DANCE_KINDS.indexOf(k.kind) * (Math.PI / 2)
    const first = target.value.find((s) => s.kind === k.kind)!
    return {
      key: k.kind,
      d: sector(mid - Math.PI / 4, mid + Math.PI / 4, R0, R + 48, 0),
      label: `${KIND_NAMES[k.kind]}: show its dances`,
      tap: () => tap(first),
    }
  })
})

const labelAt = (a: number, r: number) => {
  const x = Math.sin(a) * r
  return { x, y: -Math.cos(a) * r, anchor: x > 6 ? 'start' : x < -6 ? 'end' : 'middle' }
}
// The kinds' names round the outside, with their share of the dances.
const kindLabels = computed(() =>
  DANCE_KINDS.map((kind, i) => {
    const k = props.wheel.kinds.find((x) => x.kind === kind)
    const at = labelAt((i * Math.PI) / 2, R + 14)
    // Top and bottom labels sit clear of the wheel; the sides centre on it.
    const y = i === 0 ? at.y - 14 : i === 2 ? at.y + 6 : at.y - 6
    return { kind, ...at, y, name: KIND_NAMES[kind], share: k ? `${Math.max(1, Math.round((k.times / total.value) * 100))}%` : 'not yet', on: !!k }
  }),
)
const danceLabels = computed(() =>
  open.value ? target.value.filter((s) => s.a1 - s.a0 >= 0.2).map((s) => ({ ...labelAt((s.a0 + s.a1) / 2, R + 10), s })) : [],
)

function tap(s: Slice) {
  if (!open.value) {
    open.value = s.kind
    picked.value = null
  } else picked.value = picked.value === s.dance.name ? null : s.dance.name
}
function back() {
  open.value = null
  picked.value = null
}
const onKey = (e: KeyboardEvent, fn: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

const caption = computed(() => {
  const k = open.value && props.wheel.kinds.find((x) => x.kind === open.value)
  if (!k) return ''
  const d = picked.value && k.dances.find((x) => x.name === picked.value)
  if (d) return `${d.name}: danced ${d.times} times, placed ${d.placed}`
  return `${KIND_NAMES[k.kind]}: ${k.times} dances. Tap one for its numbers.`
})
const pattern = (k: DanceKind) => `${uid}-${k}`
</script>

<template>
  <div class="space-y-2">
    <svg viewBox="-212 -158 424 316" class="mx-auto block w-full max-w-[28rem] overflow-visible sm:max-w-[36rem]" role="group" aria-label="Saltire: dances by kind">
      <defs>
        <pattern
          v-for="k in DANCE_KINDS"
          :id="pattern(k)"
          :key="k"
          width="3.2"
          height="3.2"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="1.1" height="3.2" :fill="KIND_COLORS[k]" opacity="0.5" />
        </pattern>
      </defs>
      <!-- The saltire: a bold X from the hub out, stepping aside when a kind is open. -->
      <g
        :class="['stroke-foreground/10 transition-opacity duration-300', open && 'opacity-0']"
        stroke-width="16"
        stroke-linecap="square"
        aria-hidden="true"
      >
        <line v-for="a in [45, 135, 225, 315]" :key="a" :x1="Math.sin((a * Math.PI) / 180) * (R0 + 10)" :y1="-Math.cos((a * Math.PI) / 180) * (R0 + 10)" :x2="Math.sin((a * Math.PI) / 180) * (R + 6)" :y2="-Math.cos((a * Math.PI) / 180) * (R + 6)" />
      </g>

      <g>
        <g v-for="s in drawn" :key="s.key" :opacity="s.o">
          <path :d="sector(s.a0, s.a1, s.r, R)" :fill="`url(#${pattern(s.kind)})`" aria-hidden="true" />
          <path :d="sector(s.a0, s.a1, IN, s.r)" :fill="KIND_COLORS[s.kind]" :opacity="picked && picked !== s.name ? 0.35 : 1" />
        </g>
      </g>

      <Transition enter-active-class="motion-safe:transition-opacity motion-safe:duration-200" enter-from-class="opacity-0">
        <g v-if="!moving" :key="open ?? 'all'" aria-hidden="true">
          <template v-if="!open">
            <text
              v-for="l in kindLabels"
              :key="l.kind"
              :x="l.x"
              :y="l.y"
              :text-anchor="l.anchor"
              class="text-[11.5px] font-extrabold"
              :fill="l.on ? KIND_COLORS[l.kind] : 'var(--muted-foreground)'"
              :opacity="l.on ? 1 : 0.6"
            >
              {{ l.name }}
              <tspan :x="l.x" dy="13" class="fill-muted-foreground text-[10.5px] font-semibold">{{ l.share }}</tspan>
            </text>
          </template>
          <text
            v-for="l in danceLabels"
            :key="l.s.dance.name"
            :x="l.x"
            :y="l.y"
            dy="0.35em"
            :text-anchor="l.anchor"
            class="text-[11px] font-bold"
            :fill="KIND_COLORS[l.s.kind]"
          >
            {{ shortName(l.s.dance.name) }}
          </text>
        </g>
      </Transition>

      <!-- Tap targets, bigger than what's drawn: a whole quarter with its name, or a dance's whole slice out to the edge. -->
      <path
        v-for="h in hits"
        :key="h.key"
        :d="h.d"
        fill="transparent"
        role="button"
        tabindex="0"
        :aria-label="h.label"
        class="cursor-pointer outline-none focus-visible:fill-foreground/5"
        @click="h.tap()"
        @keydown="onKey($event, h.tap)"
      />

      <!-- The hub: how many dances, or an X to close the open kind. -->
      <g
        :role="open ? 'button' : undefined"
        :tabindex="open ? 0 : undefined"
        :aria-label="open ? 'Close' : undefined"
        :class="['outline-none', open && 'cursor-pointer']"
        @click="open && back()"
        @keydown="open && onKey($event, back)"
      >
        <circle :r="R0 - 4" class="fill-card stroke-border" />
        <g v-if="open" class="stroke-foreground" stroke-width="2.6" stroke-linecap="round">
          <line x1="-7" y1="-7" x2="7" y2="7" />
          <line x1="7" y1="-7" x2="-7" y2="7" />
        </g>
        <template v-else>
          <text y="-1" text-anchor="middle" class="fill-foreground text-[14px] font-extrabold tabular-nums">{{ total }}</text>
          <text y="11" text-anchor="middle" class="fill-muted-foreground text-[9px] font-semibold">dances</text>
        </template>
      </g>
    </svg>
    <p class="text-muted-foreground text-callout min-h-[1lh] text-center text-balance" aria-live="polite">{{ caption }}</p>
  </div>
</template>
