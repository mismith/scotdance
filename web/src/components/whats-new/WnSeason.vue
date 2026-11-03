<script setup lang="ts">
import { ref } from 'vue'
import DateTile from '@/components/DateTile.vue'
import Medal from '@/components/Medal.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import Segmented from '@/components/ui/Segmented.vue'
import WnShot from './WnShot.vue'

// The season around your dancers: judges' sheets, associations and series,
// linked weekends, and the map and calendar.
defineProps<{ shot: number }>()

const sheet = [
  { number: 142, marks: [1, 2, 1], place: 1 },
  { number: 87, marks: [2, 1, 3], place: 2 },
  { number: 203, marks: [3, 4, 2], place: 3 },
]

const year = new Date().getFullYear()
const series = [
  { name: 'Spring Indoor', date: new Date(year, 2, 14) },
  { name: 'Victoria Games', date: new Date(year, 4, 16) },
  { name: 'Coastal Classic', date: new Date(year, 6, 11) },
]
const weekend = [new Date(year, 8, 5), new Date(year, 8, 6)]
const day = ref('sat')

const pins = [
  { left: '18%', top: '22%', yours: true },
  { left: '58%', top: '48%' },
  { left: '38%', top: '72%' },
  { left: '75%', top: '14%' },
]
// A month at a glance, drawn as Competitions' calendar is: the week starts
// on Monday, competition days are tinted with a dot, today has a pink ring.
const month = new Date(year, 10, 1)
const lead = (month.getDay() + 6) % 7
const days = new Date(year, 11, 0).getDate()
// Competitions on the Saturdays, and one whole weekend; today is that weekend's Saturday.
const saturdays = Array.from({ length: days }, (_, i) => i + 1).filter((d) => new Date(year, 10, d).getDay() === 6)
const today = saturdays[1]!
const competitionDays = new Set([...saturdays, today + 1])
const calendar = [
  ...Array.from({ length: lead }, () => null),
  ...Array.from({ length: days }, (_, i) => ({ day: i + 1, on: competitionDays.has(i + 1), today: i + 1 === today })),
]
</script>

<template>
  <WnShot :index="0" :shot="shot">
    <div class="relative w-[19rem]">
      <div class="bg-card rounded-3xl px-4 py-3.5 shadow-2xl">
        <p class="mb-2 text-sm font-extrabold">Premiership Highland Fling</p>
        <div class="text-muted-foreground grid grid-cols-5 border-b pb-2 text-center text-xs font-bold">
          <span class="text-left">#</span><span>Judge 1</span><span>Judge 2</span><span>Judge 3</span><span class="text-primary">Place</span>
        </div>
        <div
          v-for="(r, i) in sheet"
          :key="r.number"
          :class="['grid grid-cols-5 items-center py-1.5 text-center font-mono tabular-nums', i === 0 && 'bg-blue-paper -mx-2 my-1 rounded-xl px-2']"
        >
          <span class="text-left font-bold">{{ r.number }}</span>
          <span v-for="(m, j) in r.marks" :key="j">{{ m }}</span>
          <span class="flex justify-center"><Medal :place="r.place" size="sm" class="scale-75" /></span>
        </div>
      </div>
      <span class="animate-float absolute -top-9 -right-5 flex rotate-[10deg] drop-shadow-xl"><Medal :place="1" size="lg" /></span>
    </div>
  </WnShot>

  <WnShot :index="1" :shot="shot">
    <div class="relative w-[18rem] pt-6">
      <span class="absolute inset-x-6 top-0 h-48 rotate-[5deg] rounded-3xl bg-white/30" aria-hidden="true" />
      <span class="absolute inset-x-3 top-2.5 h-48 rotate-[2.5deg] rounded-3xl bg-white/55" aria-hidden="true" />
      <div class="bg-card relative space-y-2 rounded-3xl p-4 shadow-2xl">
        <div class="flex items-center gap-3">
          <OrganisationMark :organisation="{ name: 'Pacific Series', shortName: 'PS', image: null }" size="lg" />
          <div>
            <p class="text-lg leading-tight font-bold">Pacific Series</p>
            <p class="text-muted-foreground text-sm">Championship series · 6 competitions</p>
          </div>
        </div>
        <div v-for="c in series" :key="c.name" class="flex items-center justify-between border-t pt-2 text-[0.9375rem]">
          <span class="font-semibold">{{ c.name }}</span>
          <span class="text-muted-foreground">{{ c.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}</span>
        </div>
      </div>
    </div>
  </WnShot>

  <WnShot :index="2" :shot="shot">
    <div class="flex w-[19rem] flex-col items-center gap-5">
      <Segmented
        v-model="day"
        label="Day"
        :options="[
          { value: 'sat', label: 'Saturday' },
          { value: 'sun', label: 'Sunday' },
        ]"
        class="bg-card/90 shadow-xl"
      />
      <div class="flex gap-3">
        <div
          v-for="(d, i) in weekend"
          :key="i"
          :class="['bg-card w-[9.25rem] space-y-1.5 rounded-3xl p-3.5 shadow-2xl', i === 0 ? '-rotate-[4deg]' : 'translate-y-2.5 rotate-[4deg] opacity-90']"
        >
          <DateTile :date="d.getTime()" :today="false" />
          <p class="text-[0.9375rem] leading-tight font-bold">{{ i === 0 ? 'Labour Day Games' : 'Labour Day Open' }}</p>
          <p class="text-muted-foreground text-xs">Day {{ i + 1 }}</p>
        </div>
      </div>
    </div>
  </WnShot>

  <WnShot :index="3" :shot="shot">
    <div class="relative h-56 w-[19.5rem]">
      <div
        class="absolute top-0 left-0 h-48 w-52 overflow-hidden rounded-3xl bg-[#dfe7d0] bg-[linear-gradient(rgb(255_255_255/0.65)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.65)_1px,transparent_1px)] bg-size-[1.5rem_1.5rem] shadow-2xl dark:bg-[#26302a]"
      >
        <svg class="absolute top-24 left-4 opacity-60" width="170" height="90" viewBox="0 0 170 90" aria-hidden="true">
          <path d="M0 70 C40 20, 80 90, 170 30" fill="none" stroke="#b9c9e0" stroke-width="10" stroke-linecap="round" />
        </svg>
        <svg
          v-for="(p, i) in pins"
          :key="i"
          :class="['absolute', p.yours ? 'size-11 animate-bounce [animation-duration:1.6s]' : 'size-8']"
          :style="{ left: p.left, top: p.top }"
          viewBox="0 0 30 40"
          aria-hidden="true"
        >
          <path d="M15 39s13-14 13-24A13 13 0 0 0 2 15c0 10 13 24 13 24z" :fill="p.yours ? 'var(--secondary)' : 'var(--primary)'" />
          <circle cx="15" cy="15" r="5" fill="#fff" />
        </svg>
      </div>
      <div class="bg-card animate-float absolute right-0 bottom-0 w-48 rotate-[4deg] rounded-3xl p-3 shadow-2xl">
        <p class="pb-1 text-[0.8125rem] font-bold">November</p>
        <div class="text-muted-foreground grid grid-cols-7 pb-0.5 text-center text-[0.5625rem] font-medium">
          <span v-for="(d, i) in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="i">{{ d }}</span>
        </div>
        <div class="grid grid-cols-7 gap-0.5 text-[0.625rem] tabular-nums">
          <span
            v-for="(c, i) in calendar"
            :key="i"
            :class="[
              'relative flex aspect-square items-center justify-center rounded-full',
              c?.on && 'bg-blue-paper font-semibold',
              c?.today && 'ring-live text-live ring-[1.5px] ring-inset',
            ]"
          >
            <template v-if="c">
              <span class="-translate-y-px">{{ c.day }}</span>
              <span v-if="c.on" class="bg-primary absolute bottom-[12%] size-[3px] rounded-full" />
            </template>
          </span>
        </div>
      </div>
    </div>
  </WnShot>
</template>
