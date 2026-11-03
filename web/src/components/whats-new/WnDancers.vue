<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import Switch from '@/components/ui/Switch.vue'
import WnShot from './WnShot.vue'
import { clothBackground, PRESETS, weavePreset } from '@/lib/tartan'
import type { DancerColor } from '@/stores/dancerColors'

// Your dancers: a profile, the looks you can give them, and a competition
// cut down to just them. Made-up dancers in the app's own pieces.
defineProps<{ shot: number }>()

const cloth = (preset: number, color: DancerColor, slot: string) => clothBackground(weavePreset(PRESETS[preset]!.sett, color), `whats-new-${slot}`)
const isla = cloth(0, 'dancer-1', 'isla')
const ruby = cloth(1, 'dancer-9', 'ruby')

const placings = [
  { place: 1, dance: 'Highland Fling', where: 'Cowal' },
  { place: 2, dance: 'Sword Dance', where: 'Braemar' },
  { place: 1, dance: 'Seann Triubhas', where: 'Spring' },
]

// Around the number card: the nine colours and a few of the tartans.
const looks = [
  'var(--dancer-5)',
  'var(--dancer-2)',
  cloth(3, 'dancer-4', 'jig'),
  'var(--dancer-3)',
  cloth(6, 'dancer-2', 'flora'),
  'var(--dancer-8)',
  cloth(4, 'dancer-7', 'hornpipe'),
  'var(--dancer-6)',
]
const orbit = looks.map((bg, i) => {
  const a = (i / looks.length) * Math.PI * 2 - Math.PI / 2
  return { bg, left: `calc(50% + ${Math.cos(a) * 128}px - 1.25rem)`, top: `calc(50% + ${Math.sin(a) * 128}px - 1.25rem)` }
})
</script>

<template>
  <WnShot :index="0" :shot="shot">
    <div class="relative w-72">
      <div class="bg-card overflow-hidden rounded-3xl shadow-2xl">
        <div class="h-14" :style="{ background: isla }" />
        <div class="-mt-8 space-y-2 px-4 pb-3.5">
          <div class="flex items-end gap-3">
            <Avatar name="Isla MacLeod" :color="isla" size="lg" class="ring-card ring-4" />
            <div class="pb-1">
              <p class="text-lg leading-tight font-bold">Isla MacLeod</p>
              <p class="text-muted-foreground text-sm">Premier · 14 competitions</p>
            </div>
          </div>
          <div v-for="p in placings" :key="p.dance" class="flex items-center gap-3">
            <Medal :place="p.place" size="sm" />
            <p class="text-[0.9375rem]"><span class="font-semibold">{{ p.dance }}</span> · {{ p.where }}</p>
          </div>
        </div>
      </div>
      <span class="animate-float absolute -top-8 -right-7 flex rotate-[8deg] drop-shadow-xl"><NumberCard number="142" :color="isla" size="md" /></span>
    </div>
  </WnShot>

  <WnShot :index="1" :shot="shot">
    <div class="relative size-80">
      <span
        v-for="(o, i) in orbit"
        :key="i"
        class="absolute size-10 scale-50 rounded-full opacity-0 shadow-lg transition duration-500 ease-(--ease-elastic) group-data-on:scale-100 group-data-on:opacity-100"
        :style="{ background: o.bg, left: o.left, top: o.top, transitionDelay: `${150 + i * 70}ms` }"
      />
      <div class="absolute inset-0 flex items-center justify-center">
        <NumberCard number="87" :color="ruby" size="xl" class="-rotate-3 shadow-2xl" />
      </div>
    </div>
  </WnShot>

  <WnShot :index="2" :shot="shot">
    <div class="relative w-[18.5rem] pt-9">
      <div class="bg-card rounded-3xl py-3 shadow-2xl">
        <p class="text-muted-foreground px-4 pb-1.5 text-xs font-bold tracking-wide">RESULTS · PREMIER 12 &amp; UNDER</p>
        <div class="flex items-center gap-3 border-l-[5px] px-4 py-2" :style="{ borderColor: 'var(--dancer-1)' }">
          <Medal :place="1" size="sm" />
          <span class="flex-1 text-base font-semibold">Isla MacLeod</span>
          <NumberCard number="142" :color="isla" size="xs" />
        </div>
        <div class="flex items-center gap-3 border-l-[5px] px-4 py-2" :style="{ borderColor: 'var(--dancer-9)' }">
          <Medal :place="3" size="sm" />
          <span class="flex-1 text-base font-semibold">Ruby Grant</span>
          <NumberCard number="87" :color="ruby" size="xs" />
        </div>
      </div>
      <div class="bg-foreground text-background animate-float absolute top-0 -left-3.5 flex -rotate-3 items-center gap-3 rounded-full py-2 pr-2 pl-4 shadow-xl">
        <span class="text-[0.9375rem] font-bold">Only my dancers</span>
        <Switch :model-value="true" aria-label="Only my dancers" tabindex="-1" />
      </div>
    </div>
  </WnShot>
</template>
