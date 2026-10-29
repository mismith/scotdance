<script setup lang="ts">
import { getOrdinalSuffix } from '@/lib/results'
import type { Unit } from '@/lib/print/model'

// One unit of a printed page (see lib/print/model), in print sizes: points
// for type, black on white whatever the app's theme. Each unit carries its
// own space below it, so the page can be packed by adding up heights.

defineProps<{ unit: Unit }>()

// Ink, and the greys a black-and-white printer keeps.
const MUTED = 'text-[#50575f]'
/** A label over a column or a group of names: small capitals' worth of emphasis. */
const LABEL = 'text-[7.5pt] font-bold tracking-[0.08em] uppercase text-[#50575f]'
/** Cells to read, and cells to write in. */
const CELL = 'border border-[#9aa1a9] px-[4pt] py-[2.5pt] align-top'
const COLUMN = 'border border-[#9aa1a9] bg-[#eef0f2] px-[4pt] py-[2.5pt] text-center font-semibold'
const ROW = 'border border-[#9aa1a9] px-[4pt] py-[2.5pt] text-left align-top font-semibold'
/** A dance down the side of a grid to write placings in. */
const DANCE = 'border border-[#9aa1a9] px-[5pt] py-[2.5pt] text-left align-middle font-normal'
/** The first column (dances) narrower as platforms add up. */
const firstCol = (columns: number) => (columns >= 8 ? '11%' : columns >= 6 ? '13%' : columns >= 4 ? '16%' : '20%')
/** Smaller type when it's a squeeze, as wide programs print theirs. */
const gridText = (columns: number) => (columns >= 8 ? 'text-[8.5pt]' : 'text-[9.5pt]')
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
</script>

<template>
  <!-- Cover -->
  <div v-if="unit.kind === 'cover'" class="flex h-full flex-col items-center text-center">
    <div class="flex flex-1 flex-col items-center justify-center gap-[16pt]">
      <img v-if="unit.cover.image" :src="unit.cover.image" alt="" class="max-h-[1.8in] max-w-[3.5in] object-contain" />
      <div>
        <h1 class="text-[28pt] leading-[1.08] font-bold tracking-[-0.015em] text-balance">{{ unit.cover.name }}</h1>
        <div class="mx-auto mt-[14pt] h-[1.5pt] w-[42pt] bg-[#15181c]" />
      </div>
      <p v-if="unit.cover.dates" class="text-[15pt] font-semibold">{{ unit.cover.dates }}</p>
      <p v-if="unit.cover.venue || unit.cover.address" class="text-[11pt] leading-[1.4]">
        <span v-if="unit.cover.venue" class="block font-semibold">{{ unit.cover.venue }}</span>
        <span v-if="unit.cover.address" class="block">{{ unit.cover.address }}</span>
      </p>
      <table v-if="unit.cover.sessions.some((s) => s.time)" class="text-[11pt] leading-[1.5]">
        <tbody>
          <tr v-for="s in unit.cover.sessions" :key="s.label">
            <td class="pr-[10pt] text-right">{{ s.label }}</td>
            <td class="text-left font-semibold tabular-nums">{{ s.time }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="unit.cover.judges.length || unit.cover.pipers.length" class="mt-[6pt] flex justify-center gap-[40pt] text-[10.5pt] leading-[1.45]">
        <div v-if="unit.cover.judges.length">
          <h2 :class="[LABEL, 'mb-[4pt]']">{{ unit.cover.judges.length === 1 ? 'Judge' : 'Judges' }}</h2>
          <p v-for="p in unit.cover.judges" :key="p.name">{{ p.name }}<span v-if="p.from" :class="MUTED">, {{ p.from }}</span></p>
        </div>
        <div v-if="unit.cover.pipers.length">
          <h2 :class="[LABEL, 'mb-[4pt]']">{{ unit.cover.pipers.length === 1 ? 'Piper' : 'Pipers' }}</h2>
          <p v-for="p in unit.cover.pipers" :key="p.name">{{ p.name }}<span v-if="p.from" :class="MUTED">, {{ p.from }}</span></p>
        </div>
      </div>
    </div>
    <p v-if="unit.cover.registrations.length" :class="['text-[8.5pt]', MUTED]">{{ unit.cover.registrations.join(' · ') }}</p>
  </div>

  <!-- A page's or section's heading -->
  <div v-else-if="unit.kind === 'heading' && unit.level === 1" class="pb-[10pt]">
    <div class="flex items-baseline justify-between gap-[8pt] border-b-[1.5pt] border-[#15181c] pb-[4pt]">
      <h2 class="text-[18pt] leading-tight font-bold tracking-[-0.01em]">{{ unit.title }}</h2>
      <span v-if="unit.aside" class="shrink-0 text-[11pt] font-semibold tabular-nums">{{ unit.aside }}</span>
    </div>
    <p v-if="unit.note" :class="['mt-[4pt] text-[9pt]', MUTED]">{{ unit.note }}</p>
  </div>
  <div v-else-if="unit.kind === 'heading'" class="pt-[4pt] pb-[6pt]">
    <div class="flex items-baseline justify-between gap-[8pt] border-b border-[#15181c] pb-[3pt]">
      <h2 class="text-[10pt] font-bold tracking-[0.06em] uppercase">{{ unit.title }}</h2>
      <span v-if="unit.aside" :class="['shrink-0 text-[9pt]', MUTED]">{{ unit.aside }}</span>
    </div>
    <p v-if="unit.note" :class="['mt-[3pt] text-[8.5pt] leading-[1.35]', MUTED]">{{ unit.note }}</p>
  </div>

  <!-- Platform grid: an event's name and its platforms -->
  <div v-else-if="unit.kind === 'gridHead'" class="pt-[6pt]">
    <div class="mb-[4pt] flex items-baseline justify-between gap-[8pt]">
      <h3 class="text-[12pt] font-bold">{{ unit.head.title }}<span v-if="unit.continued" :class="['font-normal', MUTED]"> (continued)</span></h3>
      <span v-if="unit.head.time" class="text-[10pt] font-semibold tabular-nums">{{ unit.head.time }}</span>
    </div>
    <table :class="['w-full table-fixed border-collapse', gridText(unit.head.platforms.length)]">
      <colgroup>
        <col :style="{ width: firstCol(unit.head.platforms.length) }" />
        <col v-for="p in unit.head.platforms" :key="p" />
      </colgroup>
      <thead>
        <tr>
          <th :class="COLUMN"><span class="sr-only">Dance</span></th>
          <th v-for="p in unit.head.platforms" :key="p" :class="COLUMN">{{ p }}</th>
        </tr>
      </thead>
    </table>
  </div>

  <!-- Platform grid: one dance, or a line across -->
  <table v-else-if="unit.kind === 'gridRow'" :class="['-mt-px w-full table-fixed border-collapse', gridText(unit.columns)]">
    <colgroup>
      <col :style="{ width: firstCol(unit.columns) }" />
      <col v-for="i in unit.columns" :key="i" />
    </colgroup>
    <tbody>
      <tr v-if="unit.row.kind === 'dance'">
        <th :class="ROW">{{ unit.row.name }}</th>
        <td v-for="(c, i) in unit.row.cells" :key="i" :class="CELL">
          <template v-if="c">
            <p v-if="c.judges" class="mb-[1pt] text-center font-semibold italic">{{ c.judges }}</p>
            <p v-for="(l, j) in c.lines" :key="j" class="hyphens-auto">{{ l ? l.group : '\u00a0' }}</p>
          </template>
        </td>
      </tr>
      <tr v-else>
        <td :colspan="unit.columns + 1" :class="[COLUMN, 'font-normal italic']">{{ unit.row.text }}</td>
      </tr>
    </tbody>
  </table>

  <!-- An age group: its dancers, a grid to write the placings in, its trophy -->
  <section v-else-if="unit.kind === 'ageGroup'" class="pb-[24pt] text-[10pt]">
    <header class="mb-[6pt] flex items-baseline justify-between gap-[8pt] border-b-[1.5pt] border-[#15181c] pb-[3pt]">
      <h3 class="text-[14pt] leading-tight font-bold tracking-[-0.01em]">{{ unit.group.title }}</h3>
      <span :class="['shrink-0 text-[9pt] tabular-nums', MUTED]">{{ plural(unit.group.dancers.length, 'dancer', 'dancers') }}</span>
    </header>
    <ol class="grid grid-flow-col grid-cols-2 gap-x-[24pt] leading-[1.5]" :style="{ gridTemplateRows: `repeat(${Math.ceil(unit.group.dancers.length / 2)}, auto)` }">
      <li v-for="(d, i) in unit.group.dancers" :key="i" class="grid grid-cols-[2.2em_minmax(0,1.5fr)_minmax(0,1fr)] gap-x-[7pt]">
        <span class="text-right font-semibold tabular-nums">{{ d.number }}</span>
        <span class="truncate">{{ d.name }}</span>
        <span :class="['truncate', MUTED]">{{ d.location }}</span>
      </li>
    </ol>
    <table v-if="unit.group.dances.length && unit.group.places" class="mt-[12pt] w-full table-fixed border-collapse">
      <colgroup>
        <col class="w-[32%]" />
        <col v-for="p in unit.group.places" :key="p" />
      </colgroup>
      <thead>
        <tr>
          <th class="pb-[3pt]"><span class="sr-only">Dance</span></th>
          <th v-for="p in unit.group.places" :key="p" class="pb-[3pt] text-center text-[9pt] font-semibold">
            {{ p }}<span class="align-super text-[0.72em]">{{ getOrdinalSuffix(p) }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in unit.group.dances" :key="d">
          <th :class="DANCE">{{ d }}</th>
          <td v-for="p in unit.group.places" :key="p" :class="[CELL, 'h-[24pt]']" />
        </tr>
      </tbody>
    </table>
    <p v-if="unit.group.overall" class="mt-[14pt] flex items-end gap-[6pt]">
      <span class="font-semibold">Overall winner</span>
      <span class="h-[13pt] w-[2.6in] border-b border-[#15181c]" />
    </p>
    <p v-if="unit.group.trophy" :class="['text-[9pt]', unit.group.overall ? 'mt-[4pt]' : 'mt-[10pt]', MUTED]">
      {{ unit.group.trophy }}<template v-if="unit.group.sponsor">, sponsored by {{ unit.group.sponsor }}</template>
    </p>
  </section>

  <!-- A draw that differs dance by dance (a championship's) -->
  <section v-else-if="unit.kind === 'draw'" class="pb-[18pt]">
    <header class="mb-[8pt] flex items-baseline justify-between gap-[8pt] border-b-[1.5pt] border-[#15181c] pb-[3pt]">
      <h3 class="text-[14pt] leading-tight font-bold tracking-[-0.01em]">{{ unit.draw.group }}<span v-if="unit.draw.from" :class="['font-normal', MUTED]"> (continued)</span></h3>
      <span class="shrink-0 text-[11pt] font-semibold">Draw</span>
    </header>
    <table class="w-full table-fixed border-collapse text-[10pt]">
      <thead>
        <tr>
          <th :class="[COLUMN, 'w-[4em]']">Order</th>
          <th v-for="d in unit.draw.dances" :key="d" :class="COLUMN">{{ d }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in unit.draw.rows" :key="i">
          <td :class="[CELL, 'text-center tabular-nums', MUTED]">{{ unit.draw.from + i + 1 }}</td>
          <td v-for="(n, j) in r" :key="j" :class="[CELL, 'text-center font-semibold tabular-nums']">{{ n }}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- One dance on a platform sheet -->
  <section v-else-if="unit.kind === 'platformDance'" class="pb-[12pt] text-[10pt]">
    <div class="mb-[4pt] flex items-baseline justify-between gap-[8pt]">
      <h3 class="text-[12pt] font-bold">{{ unit.dance.dance }}</h3>
      <span v-if="unit.dance.judges" class="font-semibold italic">{{ unit.dance.judges }}</span>
    </div>
    <table class="w-full table-fixed border-collapse">
      <thead>
        <tr>
          <th :class="[COLUMN, 'w-[28%] text-left']">Age group</th>
          <th :class="[COLUMN, 'w-[4.5em]']">Dancers</th>
          <th :class="[COLUMN, 'text-left']">Order</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in unit.dance.rows" :key="i">
          <td :class="CELL">{{ r.group }}</td>
          <td :class="[CELL, 'text-center tabular-nums']">{{ r.count }}</td>
          <td :class="CELL">
            <span class="font-semibold tabular-nums [word-spacing:0.35em]">{{ r.order.join(' ') }}</span>
            <span v-if="!r.drawn && r.order.length" :class="['block text-[8.5pt]', MUTED]">Number order (not drawn)</span>
            <span v-if="r.late.length" class="block text-[8.5pt]">Not in the draw: <span class="font-semibold tabular-nums">{{ r.late.join(' ') }}</span></span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
