<script setup lang="ts">
import { Printer } from '@lucide/vue'
import WnShot from './WnShot.vue'

// For organisers: the schedule builder, the printed program, and two of the
// ScotDance Toolkit's other tools, each in its own look (toolkit.scotdance.app).
defineProps<{ shot: number }>()

const program = [
  { time: '9:00', dance: 'Highland Fling', group: 'Primary', numbers: '101 104 108 112' },
  { time: '9:40', dance: 'Sword Dance', group: '8 & Under', numbers: '121 125 130 133 142' },
  { time: '10:40', dance: 'Seann Triubhas', group: 'Premier', numbers: '87 142 203 211' },
]

// Splits' groups screen: ages on the left, the groups it suggests on the right.
const ages = [
  { age: 8, count: 3 },
  { age: 9, count: 3 },
  { age: 10, count: 8 },
  { age: 11, count: 5 },
]

// Challenge's leaderboard: a podium, first in the middle.
const podium = [
  { name: 'Hazel', step: 'h-10', color: '#ff7a59' },
  { name: 'Isla', step: 'h-14', color: '#d4ff3a', first: true },
  { name: 'Freya', step: 'h-7', color: '#5ad1ff' },
]
</script>

<template>
  <WnShot :index="0" :shot="shot">
    <div class="bg-card grid w-[19.5rem] grid-cols-2 gap-3 rounded-3xl p-3.5 shadow-2xl">
      <div class="space-y-1.5">
        <p class="text-muted-foreground text-xs font-bold tracking-wide">PLATFORM 1</p>
        <p class="bg-blue-paper rounded-xl p-2.5 text-sm font-semibold">Fling · Primary</p>
        <p class="bg-blue-paper rounded-xl p-2.5 text-sm font-semibold">Sword · 8 &amp; U</p>
        <p
          class="bg-primary-fill relative z-10 rounded-xl p-2.5 text-sm font-bold text-white shadow-xl transition-[translate,rotate] delay-700 duration-1000 ease-(--ease-push) group-data-on:translate-x-[9.6rem] group-data-on:-translate-y-[2.85rem] group-data-on:-rotate-2"
        >
          Reel · 10 &amp; U
        </p>
      </div>
      <div class="space-y-1.5">
        <p class="text-muted-foreground text-xs font-bold tracking-wide">PLATFORM 2</p>
        <p class="bg-blue-paper rounded-xl p-2.5 text-sm font-semibold">Fling · Premier</p>
        <p class="text-muted-foreground rounded-xl border-2 border-dashed p-2 text-center text-[0.8125rem]">Drop here</p>
      </div>
    </div>
  </WnShot>

  <WnShot :index="1" :shot="shot">
    <div class="relative h-60 w-[18.75rem] scale-90 text-[#12161b]">
      <div class="absolute top-6 left-6 h-52 w-44 -rotate-[8deg] space-y-1.5 bg-white p-4 shadow-xl">
        <p class="text-xs font-bold">PLATFORM 2</p>
        <p class="h-0.5 bg-[#12161b]" />
        <p class="font-mono text-[0.625rem] leading-relaxed">101 · 104 · 108 · 112<br />121 · 125 · 130 · 133<br />142 · 150 · 158 · 161</p>
      </div>
      <div class="absolute top-0 left-20 h-60 w-48 rotate-[4deg] space-y-1.5 bg-white px-4 py-4 shadow-2xl">
        <p class="text-center text-[0.9375rem] leading-tight font-bold">Cowal Highland Gathering</p>
        <p class="text-center text-[0.625rem] tracking-[0.06em] text-[#454e59]">PROGRAM</p>
        <p class="h-0.5 bg-[#12161b]" />
        <template v-for="p in program" :key="p.time">
          <p class="flex justify-between text-[0.6875rem]"><b>{{ p.time }} {{ p.dance }}</b><span>{{ p.group }}</span></p>
          <p class="font-mono text-[0.625rem] text-[#454e59]">{{ p.numbers }}</p>
        </template>
      </div>
      <span class="animate-float absolute bottom-1 left-1 flex size-16 -rotate-[8deg] items-center justify-center rounded-[1.125rem] bg-[#12161b] text-[#ffd323] shadow-xl">
        <Printer class="size-8" />
      </span>
    </div>
  </WnShot>

  <WnShot :index="2" :shot="shot">
    <div class="w-[19rem] rounded-[1.375rem] bg-[#121212] p-3 text-[0.8125rem] text-[#f2f2f2] shadow-2xl">
      <div class="flex items-center gap-2.5 pb-2.5">
        <span class="flex items-center gap-2 rounded-full bg-[#1f1f1f] px-3 py-1.5 font-extrabold text-[#ffd323]"><i class="size-3 rounded-[3px] bg-[#ffd323]" />Splits</span>
        <span class="flex-1 font-semibold opacity-70">Groups</span>
        <span class="rounded-full bg-[#ffd323] px-3 py-1.5 text-[0.8125rem] font-extrabold text-[#121212]">Next</span>
      </div>
      <p class="pb-2 font-bold">Beginner <span class="ml-1 rounded-full bg-[#2a2a2a] px-2 py-0.5 text-xs tabular-nums">19</span></p>
      <div class="relative grid grid-cols-[1fr_1.5rem_1fr] gap-x-0">
        <ol class="space-y-1.5">
          <li
            v-for="(a, i) in ages"
            :key="a.age"
            :class="[
              'flex h-7 items-center justify-between rounded-lg px-2.5 transition-colors delay-700 duration-500',
              i >= 2 ? 'bg-[#2a2a2a] group-data-on:bg-[#3a3410]' : 'bg-[#2a2a2a]',
            ]"
          >
            Age {{ a.age }} <span class="tabular-nums opacity-70">{{ a.count }}</span>
          </li>
        </ol>
        <span />
        <div class="flex flex-col gap-2">
          <div class="flex flex-[6] items-center justify-between rounded-lg bg-[#2a2a2a] px-2.5 font-semibold"><span>9 &amp; Under</span><span class="tabular-nums">6</span></div>
          <div class="flex flex-[13] items-center justify-between rounded-lg bg-[#3a3410] px-2.5 font-semibold text-[#ffd323]"><span>10 &amp; Over</span><span class="tabular-nums">13</span></div>
        </div>
        <svg class="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 50 H42 C50 50 50 32.7 58 32.7 H100" fill="none" stroke="#ffd323" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  </WnShot>

  <WnShot :index="3" :shot="shot">
    <div class="relative h-60 w-44 rotate-[-4deg] overflow-hidden rounded-[2rem] border-[5px] border-[#1b1b1f] bg-[#0f0f12] p-3 text-white shadow-2xl">
      <p class="pt-1 text-center text-[0.625rem] font-semibold opacity-60">CHALLENGE</p>
      <p class="mt-0.5 text-center text-[0.9375rem] leading-tight font-extrabold">100 Flings in November</p>
      <ol class="mt-4 grid grid-cols-3 items-end gap-1.5">
        <li v-for="p in podium" :key="p.name" class="flex flex-col items-center gap-1">
          <svg v-if="p.first" width="26" height="17" viewBox="0 0 34 22" aria-hidden="true"><path d="M2 20 L4 5 L12 12 L17 2 L22 12 L30 5 L32 20 Z" fill="#d4ff3a" /></svg>
          <span
            :class="['flex items-center justify-center rounded-full font-extrabold text-[#0f0f12]', p.first ? 'size-12 text-lg shadow-[0_0_1.5rem_#d4ff3a88]' : 'size-9']"
            :style="{ background: p.color }"
            >{{ p.name[0] }}</span
          >
          <span class="text-[0.625rem] font-bold">{{ p.name }}</span>
          <span
            :class="['w-full origin-bottom scale-y-0 rounded-t-lg transition-[scale] delay-500 duration-700 ease-(--ease-elastic) group-data-on:scale-y-100', p.step]"
            :style="{ background: p.color }"
          />
        </li>
      </ol>
    </div>
  </WnShot>
</template>
