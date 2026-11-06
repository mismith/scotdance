<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import {
  useEventListener,
  usePreferredReducedMotion,
  useResizeObserver,
} from '@vueuse/core'
import {
  nextCount,
  seasonLabel,
  seasonOf,
  seasons,
  type CompetitionPoint,
  type Level,
  type Moment,
} from '@/lib/dancerProgress'
import { formatMonthAbbrev } from '@/lib/format'
import {
  across,
  blob,
  line,
  loop,
  normals,
  rng,
  sampleRoad,
  underline,
  wobble,
  type Pt,
} from '@/lib/sketch'

// A dancer's path on ScotDance.app, newest at the top: a road that wanders
// down the page through their seasons (September to August), stopping at the moments worth
// marking, drawn in felt-tip and marked up in pen like a printout someone
// was proud of. Every stop is a marker dot that the words beside it explain;
// the rare peaks (a first competition, moving up, a first trophy) are big and
// circled in pen. Seasons are ticks across the road with their years
// underlined, like the mileposts on an old road map. The road takes its own
// shape for each dancer, travels further across a long gap, and deepens in
// colour as levels go up. It draws itself down the page as it scrolls into
// view, once a visit, and each stop opens where it happened.
const props = defineProps<{
  points: CompetitionPoint[]
  moments: Moment[]
  level: Level | null
  seed: string
}>()

const LEVELS: Level[] = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier']
const DAY = 86_400_000

// Their level at a date: the latest one seen by then (points come in any order).
const levelAt = (date: number) => {
  let l: Level | null = null
  let latest = -Infinity
  for (const p of props.points)
    if (p.level && p.date <= date && p.date > latest) [l, latest] = [p.level, p.date]
  return l
}
const plural = (n: number) => `${n} competition${n === 1 ? '' : 's'}`

type Row =
  | {
      type: 'year'
      key: string
      year: number
      line: string
      f: number
      gap: number
      level: Level | null
    }
  | {
      type: 'quiet-years'
      key: string
      line: string
      f: number
      gap: number
      level: Level | null
    }
  | {
      type: 'moment'
      key: string
      m: Moment
      f: number
      gap: number
      level: Level | null
    }

// A gentle wander, the same every time for a dancer.
const seedNum = computed(() =>
  [...props.seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7),
)
const wander = (t: number) =>
  0.5 +
  0.3 *
    (0.65 * Math.sin(0.85 * t + seedNum.value) +
      0.35 * Math.sin(0.31 * t + seedNum.value * 0.7))
// Louder moments swing further out, so their words get the room they need.
const REACH = { peak: 0.16, notable: 0.34, quiet: 0.5 } as const
const reach = (f: number, m: Moment) =>
  f < 0.5 ? Math.min(f, REACH[m.weight]) : Math.max(f, 1 - REACH[m.weight])

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  let t = 0
  let prev: number | null = null
  // Time between stops: a long gap travels further and adds a little room.
  const step = (date: number) => {
    const days = prev == null ? 0 : Math.abs(prev - date) / DAY
    prev = date
    t += 0.9 + Math.min(1.6, days / 160)
    return Math.min(40, Math.sqrt(days) * 1.6)
  }
  for (const s of seasons(props.points)) {
    if (s.kind === 'gap') {
      const date = new Date(s.toYear + 1, 7, 31).getTime()
      const gap = step(date)
      out.push({
        type: 'quiet-years',
        key: `gap${s.fromYear}`,
        line: `${s.fromYear}–${s.toYear + 1}`,
        f: wander(t),
        gap,
        level: levelAt(date),
      })
      continue
    }
    const end = new Date(s.year + 1, 7, 31).getTime()
    const yearMoments = props.moments.filter((m) => seasonOf(m.date) === s.year)
    const top = Math.min(end, yearMoments[0]?.date ?? end)
    const gap = step(top)
    out.push({
      type: 'year',
      key: `y${s.year}`,
      year: s.year,
      line: `${plural(s.count)}${s.placed ? ` · placed\u00a0at\u00a0${s.placed}` : ''}`,
      f: wander(t),
      gap,
      level: levelAt(top),
    })
    yearMoments.forEach((m, i) => {
      const g = step(m.date)
      out.push({
        type: 'moment',
        key: `${s.year}-${i}-${m.kind}`,
        m,
        f: reach(wander(t), m),
        gap: g,
        level: levelAt(m.date),
      })
    })
  }
  return out
})

// Each mark's width, so the road runs through its middle.
type Mark =
  | 'now'
  | 'year'
  | 'quiet-years'
  | 'level'
  | 'count'
  | 'peak'
  | 'trophy'
  | 'notable'
  | 'quiet'
const markOf = (r: Row): Mark =>
  r.type !== 'moment'
    ? r.type
    : r.m.kind === 'level' || r.m.kind === 'count' || r.m.kind === 'trophy'
      ? r.m.kind
      : r.m.weight
const SIZE: Record<Mark, number> = {
  now: 46,
  year: 20,
  'quiet-years': 14,
  level: 34,
  count: 28,
  peak: 22,
  trophy: 22,
  notable: 12,
  quiet: 11,
}
// The anchor sits at f across; words go to whichever side has more room.
function place(r: Row) {
  const half = SIZE[markOf(r)] / 2
  return r.f < 0.5
    ? { paddingLeft: `max(0px, calc(${(r.f * 100).toFixed(1)}% - ${half}px))` }
    : { paddingRight: `max(0px, calc(${((1 - r.f) * 100).toFixed(1)}% - ${half}px))` }
}
const right = (r: Row) => r.f >= 0.5
const when = (date: number) =>
  `${formatMonthAbbrev(date)} ${new Date(date).getFullYear()}`

// A moment opens their entry at its competition; a season's trend, their results.
const route = useRoute()
const to = (m: Moment): RouteLocationRaw =>
  !m.competitionId
    ? { name: 'dancer.results', params: { dancerId: route.params.dancerId } }
    : m.entryId
      ? {
          name: 'competition.dancer',
          params: { competitionId: m.competitionId, dancerId: m.entryId },
        }
      : { name: 'competition.info', params: { competitionId: m.competitionId } }

const nowLevel = computed(() => props.level ?? 'Dancing')
const count = computed(() => props.points.length)
const since = computed(() =>
  props.points.length
    ? Math.min(...props.points.map((p) => new Date(p.date).getFullYear()))
    : null,
)
const goal = computed(() => nextCount(count.value))

// The drawing, behind the stops once they're laid out: the road in felt-tip,
// then each stop's marks (strokes trace themselves, dots land).
interface Ink {
  d: string
  color: string
  /** A stroke's width; none for a filled dot. */
  width?: number
  /** A dot with a sliver of page round it, so the road stops short of it. */
  halo?: boolean
  /** Drawn after the stop's first mark: 1 just after, 2 last. */
  later?: 1 | 2
}
const INK = {
  marker: 'var(--foreground)',
  faint: 'var(--muted-foreground)',
  blue: 'var(--primary-fill)',
  gold: 'var(--dancer-4)',
  pen: 'var(--primary)',
  paper: 'var(--background)',
}
const box = ref<HTMLElement | null>(null)
const road = ref<{ d: string; color: string; dashed: boolean }[]>([])
const marks = ref<Ink[][]>([])
const whole = ref('')
const size = ref({ w: 0, h: 0 })
// Each stop's height and how far along the road it is, for drawing it in.
const ys = ref<number[]>([])
const along = ref<number[]>([])

function marksAt(a: HTMLElement, p: Pt, n: Pt, r: () => number, at: DOMRect): Ink[] {
  const k = a.dataset.mark as Mark
  const side = (d: number) => ({ x: p.x + n.y * d, y: p.y - n.x * d })
  // Peaks are circled in pen, round the dot and its words.
  const circled = (color: string): Ink => {
    const rs = [...(a.closest('[data-stop]')?.children ?? [])].map((c) =>
      c.getBoundingClientRect(),
    )
    const L = Math.min(...rs.map((q) => q.left))
    const R = Math.max(...rs.map((q) => q.right))
    const T = Math.min(...rs.map((q) => q.top))
    const B = Math.max(...rs.map((q) => q.bottom))
    const c = { x: (L + R) / 2 - at.left, y: (T + B) / 2 - at.top }
    const rx = Math.min((R - L) / 2 + 13, at.width / 2 + 6)
    return {
      d: loop(c, rx, (B - T) / 2 + 9, r, 0.38, (r() - 0.5) * 0.06),
      color,
      width: 1.7,
      later: 2,
    }
  }
  switch (k) {
    case 'now':
      return [{ d: blob(p, 23, r, 0.05), color: INK.marker }]
    case 'count':
      return [{ d: blob(p, 14, r, 0.06), color: INK.marker, halo: true }]
    case 'notable':
      return [{ d: blob(p, 6, r, 0.08), color: INK.marker, halo: true }]
    case 'quiet':
      return [
        { d: blob(p, 6, r, 0), color: INK.paper },
        { d: loop(p, 4.4, 4.4, r, 0.2), color: INK.faint, width: 2.2 },
      ]
    case 'peak':
    case 'trophy': {
      const color = k === 'trophy' ? INK.gold : INK.blue
      return [
        { d: blob(p, 11, r, 0.07), color, halo: true },
        circled(k === 'trophy' ? INK.gold : INK.pen),
      ]
    }
    case 'level':
      return [
        { d: across(side(-3), n, 30, r), color: INK.blue, width: 2.8 },
        { d: across(side(3), n, 30, r), color: INK.blue, width: 2.8, later: 1 },
        circled(INK.pen),
      ]
    case 'quiet-years':
      return [{ d: across(p, n, 13, r), color: INK.faint, width: 3 }]
    case 'year': {
      const out: Ink[] = [{ d: across(p, n, 20, r), color: INK.marker, width: 3 }]
      // The season's years, underlined in pen.
      const label = a.parentElement?.querySelector('[data-year]')
      if (label) {
        const range = document.createRange()
        range.selectNodeContents(label)
        const t = range.getBoundingClientRect()
        out.push({
          d: underline(
            t.left - at.left - 3,
            t.right - at.left + 5,
            t.bottom - at.top + 1.5,
          ),
          color: INK.pen,
          width: 1.6,
          later: 1,
        })
      }
      return out
    }
  }
}

function measure() {
  const el = box.value
  if (!el) return
  const at = el.getBoundingClientRect()
  const anchors = [...el.querySelectorAll<HTMLElement>('[data-anchor]')]
  const stops = anchors.map((a) => {
    const r = a.getBoundingClientRect()
    return { x: r.left + r.width / 2 - at.left, y: r.top + r.height / 2 - at.top }
  })
  const { P, at: idx, along: dist } = sampleRoad(stops)
  const N = normals(P)
  const r = rng(seedNum.value)
  // The road a stretch at a time: its colour changes with the level, and the
  // quiet years are dashed.
  const levelOf = (i: number) =>
    Math.max(0, LEVELS.indexOf(anchors[i + 1]?.dataset.level as Level))
  const quietOf = (i: number) =>
    anchors[i].dataset.mark === 'quiet-years' ||
    anchors[i + 1]?.dataset.mark === 'quiet-years'
  const runs: { from: number; to: number }[] = []
  for (let i = 0; i < stops.length - 1; i++) {
    const last = runs.at(-1)
    if (last && levelOf(i) === levelOf(last.from) && quietOf(i) === quietOf(last.from))
      last.to = i
    else runs.push({ from: i, to: i })
  }
  road.value = runs.map(({ from, to }) => ({
    d: line(wobble(P.slice(idx[from], idx[to + 1] + 1), 0.5, r, 30)),
    color: `color-mix(in oklab, var(--primary-fill) ${24 + levelOf(from) * 15}%, var(--border))`,
    dashed: quietOf(from),
  }))
  whole.value = line(P)
  marks.value = anchors.map((a, i) =>
    marksAt(a, stops[i], N[idx[i]], rng(seedNum.value * 31 + i), at),
  )
  size.value = { w: el.clientWidth, h: el.clientHeight }
  ys.value = stops.map((p) => p.y)
  along.value = dist
  reveal()
}
useResizeObserver(box, measure)
watch(rows, () => nextTick(measure), { immediate: true })

// Drawing in: the road reaches down to just above the bottom of the screen,
// never back up, and eases after it. Reduce Motion shows it all at once.
const reduce = usePreferredReducedMotion()
const maskId = useId()
let reachY = -Infinity
const shown = ref(0)
const total = computed(() => along.value.at(-1) ?? 0)
function lengthAt(y: number) {
  const [y0, a] = [ys.value, along.value]
  if (a.length !== y0.length || !a.length) return 0
  if (reduce.value === 'reduce' || y >= y0.at(-1)!) return total.value
  const i = y0.findIndex((v) => v > y)
  if (i <= 0) return 0
  return a[i - 1] + ((a[i] - a[i - 1]) * (y - y0[i - 1])) / (y0[i] - y0[i - 1])
}
let raf = 0
function tick() {
  const goal = lengthAt(reachY)
  // A quick flick skips ahead, so it's drawing near what's on screen.
  const from = Math.max(shown.value, goal - innerHeight * 0.5)
  const gap = goal - from
  shown.value = gap < 1 ? goal : from + Math.max(gap * 0.12, Math.min(gap, 4))
  raf = shown.value === goal ? 0 : requestAnimationFrame(tick)
}
function reveal() {
  const el = box.value
  if (!el || !el.isConnected) return
  reachY = Math.max(reachY, innerHeight * 0.85 - el.getBoundingClientRect().top)
  if (reduce.value === 'reduce') shown.value = lengthAt(reachY)
  else if (!raf) raf = requestAnimationFrame(tick)
}
useEventListener('scroll', reveal, { passive: true })
// A stop's marks go down once the road gets to it.
const reached = (i: number) => along.value[i] != null && shown.value >= along.value[i] - 2
const LATER = { 1: 'delay-150', 2: 'delay-300 duration-700' }
const inkClass = (i: number, p: Ink) =>
  p.width
    ? [
        '[stroke-dasharray:1_1] transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none',
        p.later && LATER[p.later],
        reached(i) ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]',
      ]
    : [
        'transform-fill origin-center transition-[scale,opacity] duration-(--dur-slow) ease-(--ease-elastic) motion-reduce:transition-none',
        !reached(i) && 'scale-0 opacity-0',
      ]
const numClass = (i: number) => [
  'transition-opacity duration-300 motion-reduce:transition-none',
  !reached(i) && 'opacity-0',
]
</script>

<template>
  <div ref="box" class="relative">
    <svg
      class="pointer-events-none absolute inset-0 size-full overflow-visible"
      :viewBox="`0 0 ${size.w || 1} ${size.h || 1}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <mask
        :id="maskId"
        maskUnits="userSpaceOnUse"
        x="-20"
        y="-20"
        :width="size.w + 40"
        :height="size.h + 40"
      >
        <path
          v-if="total"
          :d="whole"
          stroke="white"
          stroke-width="16"
          stroke-linecap="round"
          fill="none"
          :style="{
            strokeDasharray: `${total} ${total + 40}`,
            strokeDashoffset: total - shown,
          }"
        />
      </mask>
      <g :mask="`url(#${maskId})`" opacity="0.7">
        <path
          v-for="(s, i) in road"
          :key="i"
          :d="s.d"
          :stroke="s.color"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
          :stroke-dasharray="s.dashed ? '3 9' : undefined"
        />
      </g>
      <template v-for="(m, i) in marks" :key="i">
        <path
          v-for="(p, j) in m"
          :key="j"
          :d="p.d"
          :fill="p.width ? 'none' : p.color"
          :stroke="p.width ? p.color : p.halo ? 'var(--background)' : undefined"
          :stroke-width="p.width ?? (p.halo ? 3 : undefined)"
          :pathLength="p.width ? 1 : undefined"
          paint-order="stroke"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="inkClass(i, p)"
        />
      </template>
    </svg>

    <ol class="relative">
      <!-- Now: where they are, and the next count to reach. -->
      <li class="flex items-center gap-3 pb-6">
        <span
          data-anchor
          data-mark="now"
          :data-level="level ?? ''"
          class="text-background grid size-11.5 shrink-0 place-items-center text-lg font-extrabold tabular-nums"
        >
          <span :class="numClass(0)">{{ count }}</span>
        </span>
        <span class="min-w-0">
          <span class="block text-lg leading-tight font-extrabold">{{ nowLevel }}</span>
          <span class="text-muted-foreground text-footnote block">
            {{ plural(count) }} on ScotDance.app since {{ since }} ·
            {{ goal - count }} more to reach {{ goal }}
          </span>
        </span>
      </li>

      <li
        v-for="(r, i) in rows"
        :key="r.key"
        :style="{ paddingTop: `${r.gap}px` }"
        :class="['flex pb-5.5', right(r) && 'justify-end']"
      >
        <!-- A season: a milepost across the road, and how it went. -->
        <div
          v-if="r.type !== 'moment'"
          :class="[
            'flex items-center gap-2.5',
            right(r) && 'flex-row-reverse text-right',
          ]"
          :style="place(r)"
        >
          <span
            data-anchor
            :data-mark="r.type"
            :data-level="r.level ?? ''"
            :class="['h-2 shrink-0', r.type === 'year' ? 'w-5' : 'w-3.5']"
          />
          <span v-if="r.type === 'year'" class="min-w-0">
            <span class="text-footnote block font-extrabold tabular-nums"
              ><span data-year>{{ seasonLabel(r.year) }}</span></span
            >
            <span class="text-callout block">{{ r.line }}</span>
          </span>
          <span v-else class="text-muted-foreground min-w-0 font-semibold">
            <span class="text-footnote block tabular-nums">{{ r.line }}</span>
            <span class="text-callout block">No competitions on ScotDance.app</span>
          </span>
        </div>

        <!-- A moment: a dot, as big as it deserves, opening where it happened. -->
        <div v-else class="flex min-w-0" :style="place(r)">
          <RouterLink
            data-stop
            :to="to(r.m)"
            :class="[
              'press-row focus-inset -m-2 flex min-w-0 items-center gap-2.5 p-2',
              right(r) && 'flex-row-reverse text-right',
            ]"
          >
            <span
              data-anchor
              :data-mark="markOf(r)"
              :data-level="r.level ?? ''"
              :style="{
                width: `${SIZE[markOf(r)]}px`,
                height: `${r.m.kind === 'level' ? 8 : SIZE[markOf(r)]}px`,
              }"
              class="text-background grid shrink-0 place-items-center text-xs font-extrabold tabular-nums"
            >
              <span v-if="r.m.kind === 'count'" :class="numClass(i + 1)">{{
                r.m.n
              }}</span>
            </span>
            <span class="min-w-0">
              <span
                :class="[
                  'block text-balance',
                  r.m.weight === 'peak' && 'text-lg leading-tight font-extrabold',
                  r.m.weight === 'notable' && 'leading-snug font-bold',
                  r.m.weight === 'quiet' &&
                    'text-muted-foreground text-footnote font-bold',
                ]"
              >
                {{ r.m.title }}
              </span>
              <span
                v-if="r.m.weight !== 'quiet'"
                class="text-muted-foreground text-footnote block"
              >
                {{ r.m.kind === 'level' ? when(r.m.date) : r.m.detail }}
              </span>
            </span>
          </RouterLink>
        </div>
      </li>
    </ol>
  </div>
</template>
