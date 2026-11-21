<script setup lang="ts" generic="T extends SwipePlatform">
import { computed, ref, useTemplateRef } from 'vue'
import { ChevronRight } from '@lucide/vue'
import DancerStars from '@/components/DancerStars.vue'

// A dance's platforms side by side, since they dance at the same time: each
// a column you swipe between, the next one peeking in at the edge. When one
// of your dancers is on a platform further along, a star in their colour
// sits on the peek (several overlap), and takes
// you to the nearest.
const props = defineProps<{ platforms: T[] }>()
defineSlots<{ default(props: { platform: T; index: number }): unknown }>()

const track = useTemplateRef<HTMLElement>('track')
const active = ref(0)
const many = () => props.platforms.length > 1
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const columns = () => [...(track.value?.querySelectorAll<HTMLElement>(':scope > [data-column]') ?? [])]
const leftOf = (cols: HTMLElement[], i: number) => cols[i].offsetLeft - cols[0].offsetLeft

function onScroll() {
  const el = track.value
  const cols = columns()
  if (!el || !cols.length) return
  let best = 0
  cols.forEach((_, i) => {
    if (Math.abs(leftOf(cols, i) - el.scrollLeft) < Math.abs(leftOf(cols, best) - el.scrollLeft)) best = i
  })
  active.value = best
}

// Your dancers on the platforms further along, and the nearest of those.
const after = computed(() => {
  const ahead = props.platforms.slice(active.value + 1)
  const i = ahead.findIndex((p) => p.dots.length)
  if (i < 0) return null
  const seen = new Set<string>()
  const dots = ahead.flatMap((p) => p.dots).filter((d) => !seen.has(d.id) && seen.add(d.id))
  return { index: active.value + 1 + i, name: ahead[i].name, dots }
})

function go(i: number) {
  const cols = columns()
  if (cols[i]) track.value?.scrollTo({ left: leftOf(cols, i), behavior: reduceMotion() ? 'instant' : 'smooth' })
}

</script>

<script lang="ts">
export interface SwipePlatform {
  id: string
  name: string
  dots: { id: string; color: string | null }[]
}
</script>

<template>
  <div class="relative">
    <div
      ref="track"
      :class="[
        '-mx-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        // The next platform fades out where it peeks in.
        many() && '[mask-image:linear-gradient(to_right,black_calc(100%-3.5rem),rgb(0_0_0/0.12))]',
      ]"
      @scroll.passive="onScroll"
    >
      <div
        v-for="(p, i) in platforms"
        :key="p.id"
        data-column
        :class="[
          'shrink-0 snap-start pt-1',
          many() ? 'w-[calc(100%-3rem)]' : 'w-full',
          i > 0 && 'border-foreground/10 border-l',
        ]"
      >
        <slot :platform="p" :index="i" />
      </div>
      <!-- Room for the last platform to line up at the start too. -->
      <div v-if="many()" class="w-12 shrink-0" aria-hidden="true" />
    </div>
    <!-- One of yours further along: a pill on the faded peek, level with the
         platform names, that takes you there. -->
    <button
      v-if="after"
      type="button"
      :aria-label="`${after.name}: ${after.dots.length > 1 ? 'your dancers' : 'one of your dancers'}`"
      class="press frosted-paper menu-edge absolute top-1 -right-2 flex h-8 items-center gap-0.5 rounded-full px-2 after:absolute after:-inset-1.5"
      @click="go(after.index)"
    >
      <DancerStars :colors="after.dots.map((d) => d.color)" />
      <ChevronRight class="text-muted-foreground size-4" stroke-width="2.5" />
    </button>
  </div>
</template>
