<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useRafFn } from '@vueuse/core'
import { Pause, Play, RotateCcw } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import { useWhatsNew } from '@/composables/useWhatsNew'
import WnAlerts from './WnAlerts.vue'
import WnDancers from './WnDancers.vue'
import WnOrganisers from './WnOrganisers.vue'
import WnSeason from './WnSeason.vue'

// What's new, as a reel: four slides, each a few pictures that play on their
// own. The headline is on the picture, so a glance is enough; the line under
// it is for anyone who pauses or taps through (the picture's left and right
// edges step back and on, playing or not).
const whatsNew = useWhatsNew()

interface Slide {
  eyebrow: string
  dark: boolean
  stage: string
  pattern: string
  visual: Component
  shots: Array<[headline: string, line: string]>
}
const tartan = (line: string) =>
  `repeating-linear-gradient(0deg, rgb(0 0 0 / 0.22) 0 10px, transparent 10px 28px), repeating-linear-gradient(90deg, ${line} 0 5px, transparent 5px 28px), repeating-linear-gradient(90deg, rgb(0 0 0 / 0.16) 0 12px, transparent 12px 28px)`
const SLIDES: Slide[] = [
  {
    eyebrow: 'Your dancers',
    dark: true,
    stage: 'radial-gradient(130% 100% at 20% 0%, #ff6b7d 0%, #c8102e 42%, #5a0615 100%)',
    pattern: tartan('rgb(255 214 0 / 0.9)'),
    visual: WnDancers,
    shots: [
      ['Dancer profiles', 'Every placing, competition after competition, season after season.'],
      ['Colours and tartans', 'Pick a colour or tartan for each of your dancers. It follows them across the app.'],
      ['Focus on yours', 'Turn on “Only my dancers” to see just yours in any competition’s dancers and results.'],
    ],
  },
  {
    eyebrow: 'Alerts',
    dark: true,
    stage: 'radial-gradient(130% 100% at 30% 0%, #4aa6ff 0%, #0065bd 45%, #031d3d 100%)',
    pattern: 'repeating-radial-gradient(circle at 50% 62%, rgb(255 255 255 / 0.35) 0 1px, transparent 1px 34px)',
    visual: WnAlerts,
    shots: [
      ['Push notifications', 'A notification the moment your dancers place, even with the app closed.'],
      ['Choose which ones', 'Results, a reminder the morning they dance, and when a dancer list goes up.'],
      ['Tap the bell', 'Tap the bell on any dancer or competition to get its notifications.'],
    ],
  },
  {
    eyebrow: 'The Highland season',
    dark: true,
    stage: 'radial-gradient(130% 100% at 25% 0%, #b48cff 0%, #5b2ca0 48%, #1d0a3c 100%)',
    pattern: 'repeating-radial-gradient(ellipse at 70% 120%, rgb(255 255 255 / 0.5) 0 1px, transparent 1px 22px)',
    visual: WnSeason,
    shots: [
      ['Judges’ sheets', 'See how each judge placed the dancers in Championships and Premierships.'],
      ['Organisations', 'Every competition an association, games society or series runs, on one page.'],
      ['Linked weekends', 'Competitions on the same weekend are linked, so you can switch days in a tap.'],
      ['Map and calendar', 'Find competitions on a map or a calendar, near you or anywhere.'],
    ],
  },
  {
    eyebrow: 'For organisers',
    dark: false,
    stage: 'radial-gradient(130% 100% at 25% 0%, #fff1a8 0%, #ffd323 45%, #e09a00 100%)',
    pattern: 'radial-gradient(rgb(120 70 0 / 0.5) 1.4px, transparent 1.6px) 0 0 / 18px 18px',
    visual: WnOrganisers,
    shots: [
      ['Schedule builder', 'Drag dances onto platforms to build the day.'],
      ['Printed program', 'Print the program and platform sheets, ready for the day.'],
      ['Splits', 'More tools in the ScotDance Toolkit: Splits makes age groups and numbers from entries.'],
      ['Challenge', 'Also in the toolkit: a practice challenge for your dancers, all year.'],
    ],
  },
]
const SHOT_MS = 2800

const slide = ref(0)
const elapsed = ref(0)
const playing = ref(true)
const done = ref(false)

const current = computed(() => SLIDES[slide.value]!)
const shot = computed(() => Math.min(current.value.shots.length - 1, Math.floor(elapsed.value / SHOT_MS)))
const progress = computed(() => (done.value ? 1 : Math.min(1, (elapsed.value - shot.value * SHOT_MS) / SHOT_MS)))
const last = SLIDES.length - 1

const { pause, resume } = useRafFn(
  ({ delta }) => {
    const length = current.value.shots.length * SHOT_MS
    if (elapsed.value + delta < length) return void (elapsed.value += delta)
    if (slide.value < last) {
      slide.value++
      elapsed.value = 0
    } else {
      elapsed.value = length - 1
      done.value = true
      playing.value = false
    }
  },
  { immediate: false },
)
watch(
  () => whatsNew.open && playing.value,
  (on) => (on ? resume() : pause()),
)
watch(
  () => whatsNew.open,
  (open) => {
    if (!open) return
    slide.value = 0
    elapsed.value = 0
    done.value = false
    playing.value = true
  },
)

function go(to: number, at = 0) {
  slide.value = to
  elapsed.value = at * SHOT_MS
  done.value = false
}
// Back or on one picture, into the next or last slide at the ends.
function step(by: 1 | -1) {
  const to = shot.value + by
  if (to < 0) return slide.value > 0 ? go(slide.value - 1, SLIDES[slide.value - 1]!.shots.length - 1) : go(0)
  if (to >= current.value.shots.length) return slide.value < last ? go(slide.value + 1) : whatsNew.close()
  go(slide.value, to)
}
function toggle() {
  if (done.value) {
    go(0)
    playing.value = true
  } else playing.value = !playing.value
}
</script>

<template>
  <Dialog :open="whatsNew.open" variant="sheet" size="md" aria-label="What’s new" @close="whatsNew.close()">
    <!-- Quick taps on the picture's edges step through it, so a double tap mustn't zoom. -->
    <div class="flex touch-manipulation flex-col px-4 pb-[calc(1rem+var(--safe-bottom))] md:pt-4">
      <p class="text-primary text-sm font-bold tracking-[0.03em] uppercase">What’s new</p>

      <div
        class="relative mt-3 h-[min(31rem,52dvh)] overflow-hidden rounded-[1.875rem] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1.25rem_2.5rem_-1.5rem_rgb(0_0_0/0.5)] transition-[background] duration-700"
        :style="{ background: current.stage }"
      >
        <div class="absolute -inset-10 -rotate-12 opacity-20" :style="{ background: current.pattern }" aria-hidden="true" />
        <div class="absolute inset-x-[-20%] -bottom-[45%] h-4/5 bg-[radial-gradient(closest-side,rgb(255_255_255/0.28),transparent)]" aria-hidden="true" />

        <div class="absolute inset-x-0 top-36 bottom-2.5">
          <component :is="current.visual" :key="slide" :shot="shot" />
        </div>

        <button type="button" class="absolute inset-y-0 left-0 w-1/3" aria-label="Back" @click="step(-1)" />
        <button type="button" class="absolute inset-y-0 right-0 w-1/3" aria-label="Next" @click="step(1)" />

        <!-- One headline at a time (a list of them read as a title and its
             subtitles), and a bar per picture under it. -->
        <div :class="['pointer-events-none absolute inset-x-5 top-5', current.dark ? 'text-white' : 'text-[#12161b]']">
          <p class="text-xs font-extrabold tracking-[0.08em] uppercase opacity-70">{{ current.eyebrow }}</p>
          <div class="relative mt-1 h-[4.25rem]">
            <p
              v-for="([headline], i) in current.shots"
              :key="`${slide}-${i}`"
              :class="[
                'absolute inset-x-0 top-0 text-[1.9375rem] leading-[1.1] font-extrabold tracking-[-0.025em] text-balance [text-shadow:0_2px_14px_rgb(0_0_0/0.18)] transition duration-400 ease-(--ease-standard)',
                i === shot ? 'opacity-100' : ['opacity-0', i < shot ? '-translate-y-2' : 'translate-y-2'],
              ]"
              :aria-hidden="i !== shot || undefined"
            >
              {{ headline }}
            </p>
          </div>
          <div class="mt-1 flex gap-1.5" aria-hidden="true">
            <span v-for="(_, i) in current.shots" :key="i" class="h-1 w-7 overflow-hidden rounded-full bg-current/30">
              <span class="block h-full rounded-full bg-current" :style="{ width: `${i < shot ? 100 : i > shot ? 0 : progress * 100}%` }" />
            </span>
          </div>
        </div>
      </div>

      <div class="relative mt-3 min-h-[3.75rem]" aria-live="polite">
        <p
          v-for="([, line], i) in current.shots"
          :key="`${slide}-${i}`"
          :class="[
            'text-muted-foreground absolute inset-x-0 top-0 text-base transition duration-300',
            i === shot ? 'opacity-100' : 'pointer-events-none translate-y-1.5 opacity-0',
          ]"
          :aria-hidden="i !== shot || undefined"
        >
          {{ line }}
        </p>
      </div>

      <div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center">
        <button
          type="button"
          class="press flex size-11 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)]"
          :aria-label="done ? 'Play again' : playing ? 'Pause' : 'Play'"
          @click="toggle"
        >
          <RotateCcw v-if="done" class="size-5" stroke-width="2.4" />
          <Pause v-else-if="playing" class="size-4 fill-current" />
          <Play v-else class="size-4 fill-current" />
        </button>
        <div class="flex gap-1.5" aria-hidden="true">
          <span
            v-for="(_, i) in SLIDES"
            :key="i"
            :class="['h-2 rounded-full transition-[width,background-color] duration-300', i === slide ? 'bg-primary w-6' : 'bg-foreground/20 w-2']"
          />
        </div>
        <Button variant="primary" size="lg" class="justify-self-end" @click="slide < last ? go(slide + 1) : whatsNew.close()">
          {{ slide < last ? 'Next' : 'Done' }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>
