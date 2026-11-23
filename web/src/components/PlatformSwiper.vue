<script setup lang="ts" generic="T extends SwipePlatform">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useTemplateRef } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import DancerStars from '@/components/DancerStars.vue'

// A dance's platforms side by side, since they dance at the same time: each
// a column you swipe between, the next one peeking in at the edge. When one
// of your dancers is on a platform further along, a star in their colour
// sits on the peek (several overlap), and takes
// you to the nearest.
//
// On wider screens they share the width, and only scroll when there are more
// than fit. Arrows beside the dance's name (`head`) scroll them on wide
// screens and wherever there's a mouse (a narrow window too), since a mouse
// wheel can't go sideways; touch screens swipe.
const props = defineProps<{ platforms: T[] }>()
defineSlots<{ default(props: { platform: T; index: number }): unknown; head?(): unknown }>()
// Which platform is in view, so a question about one asks about the one you're looking at.
const emit = defineEmits<{ active: [platformId: string] }>()

const track = useTemplateRef<HTMLElement>('track')
const active = ref(0)
const many = () => props.platforms.length > 1
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const columns = () => [...(track.value?.querySelectorAll<HTMLElement>(':scope > [data-column]') ?? [])]
const leftOf = (cols: HTMLElement[], i: number) => cols[i].offsetLeft - cols[0].offsetLeft

// Whether they don't all fit, and where the scroll is.
const overflows = ref(false)
const atStart = ref(true)
const atEnd = ref(false)
function measure() {
  const el = track.value
  if (!el) return
  overflows.value = el.scrollWidth > el.clientWidth + 1
  atStart.value = el.scrollLeft <= 1
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}
const wideQuery = matchMedia('(min-width: 48rem)')
const mouseQuery = matchMedia('(hover: hover) and (pointer: fine)')
const wide = ref(wideQuery.matches)
const mouse = ref(mouseQuery.matches)
const onWide = () => {
  wide.value = wideQuery.matches
  mouse.value = mouseQuery.matches
}
const arrows = computed(() => overflows.value && (wide.value || mouse.value))
let resize: ResizeObserver | null = null
onMounted(() => {
  wideQuery.addEventListener('change', onWide)
  mouseQuery.addEventListener('change', onWide)
  if (track.value) (resize = new ResizeObserver(measure)).observe(track.value)
})
onBeforeUnmount(() => {
  wideQuery.removeEventListener('change', onWide)
  mouseQuery.removeEventListener('change', onWide)
  resize?.disconnect()
})

function onScroll() {
  measure()
  const el = track.value
  const cols = columns()
  if (!el || !cols.length) return
  let best = 0
  cols.forEach((_, i) => {
    if (Math.abs(leftOf(cols, i) - el.scrollLeft) < Math.abs(leftOf(cols, best) - el.scrollLeft)) best = i
  })
  if (best !== active.value) emit('active', props.platforms[best]?.id)
  active.value = best
}

// Your dancers on the platforms further along, and the nearest of those.
// Only when none of yours are on screen (the platform showing, or the one
// peeking in, whose colours already show at its edge) but some are further
// along, out of sight.
const after = computed(() => {
  const inView = props.platforms.slice(active.value, active.value + 2)
  if (inView.some((p) => p.dots.length)) return null
  const beyond = props.platforms.slice(active.value + 2)
  const i = beyond.findIndex((p) => p.dots.length)
  if (i < 0) return null
  const seen = new Set<string>()
  const dots = beyond.flatMap((p) => p.dots).filter((d) => !seen.has(d.id) && seen.add(d.id))
  return { index: active.value + 2 + i, name: beyond[i].name, dots }
})

function go(i: number) {
  const cols = columns()
  if (cols[i]) track.value?.scrollTo({ left: leftOf(cols, i), behavior: reduceMotion() ? 'instant' : 'smooth' })
}

// Where the edges fade: the next platform where it peeks in, and with arrows
// scrolled along, the one before too.
const mask = computed(() => {
  if (!many() || !overflows.value) return null
  const start = arrows.value && !atStart.value
  const end = !atEnd.value || !arrows.value
  if (start && end) return '[mask-image:linear-gradient(to_right,rgb(0_0_0/0.12),black_3.5rem,black_calc(100%-3.5rem),rgb(0_0_0/0.12))]'
  if (start) return '[mask-image:linear-gradient(to_right,rgb(0_0_0/0.12),black_3.5rem)]'
  if (end) return '[mask-image:linear-gradient(to_right,black_calc(100%-3.5rem),rgb(0_0_0/0.12))]'
  return null
})

// A page kept while you look at another (PageStack) is taken off screen,
// which resets any sideways scroll: come back to the platform you were on.
let kept = 0
onDeactivated(() => (kept = active.value))
onActivated(() => {
  const cols = columns()
  if (track.value && cols[kept]) track.value.scrollLeft = leftOf(cols, kept)
  active.value = kept
  measure()
})

</script>

<script lang="ts">
export interface SwipePlatform {
  id: string
  name: string
  dots: { id: string; color: string | null }[]
}
</script>

<template>
  <div>
    <!-- The dance's name, with the arrows level with it: one platform at a
         time (stars on them read as a puzzle, so touch screens only). -->
    <div class="flex items-end gap-3">
      <div class="min-w-0 flex-1"><slot name="head" /></div>
      <div v-if="arrows" class="flex shrink-0 gap-1 pb-2">
        <button
          type="button"
          aria-label="Previous platform"
          :disabled="atStart"
          class="press frosted-paper menu-edge flex size-8 items-center justify-center rounded-full disabled:opacity-40"
          @click="go(active - 1)"
        >
          <ChevronLeft class="text-muted-foreground size-4" stroke-width="2.5" />
        </button>
        <button
          type="button"
          aria-label="Next platform"
          :disabled="atEnd"
          class="press frosted-paper menu-edge flex size-8 items-center justify-center rounded-full disabled:opacity-40"
          @click="go(active + 1)"
        >
          <ChevronRight class="text-muted-foreground size-4" stroke-width="2.5" />
        </button>
      </div>
    </div>
    <div class="relative">
      <div
        ref="track"
        :class="['-mx-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', mask]"
        @scroll.passive="onScroll"
      >
        <div
          v-for="(p, i) in platforms"
          :key="p.id"
          data-column
          :class="[
            'shrink-0 snap-start pt-1',
            many() ? 'w-[calc(100%-3rem)] md:w-auto md:min-w-72 md:flex-1' : 'w-full',
            i > 0 && 'border-foreground/10 border-l',
          ]"
        >
          <slot :platform="p" :index="i" />
        </div>
        <!-- Room for the last platform to line up at the start too (phones). -->
        <div v-if="many()" class="w-12 shrink-0 md:hidden" aria-hidden="true" />
      </div>
      <!-- Touch: one of yours further along, a pill on the faded peek, level
           with the platform names, that takes you there. -->
      <button
        v-if="after && !arrows"
        type="button"
        :aria-label="`${after.name}: ${after.dots.length > 1 ? 'your dancers' : 'one of your dancers'}`"
        class="press frosted-paper menu-edge absolute top-1 -right-2 flex h-8 items-center gap-0.5 rounded-full px-2 after:absolute after:-inset-1.5"
        @click="go(after.index)"
      >
        <DancerStars :colors="after.dots.map((d) => d.color)" />
        <ChevronRight class="text-muted-foreground size-4" stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>
