<script setup lang="ts">
// A little drawing of a judges' sheet (not the sheet itself, so a results
// page downloads nothing for it): a title, a rule, and rows of marks in a
// number column and the judges' columns. A second page peeks out behind
// when there's more than one.
withDefaults(defineProps<{ pages?: number }>(), { pages: 1 })

const ROWS = 6
// How full each judge's mark is, so the rows read as numbers, not stripes.
const widths = ['w-full', 'w-2/3', 'w-full', 'w-1/2', 'w-2/3', 'w-full']
</script>

<template>
  <span class="relative block h-12 w-9 shrink-0" aria-hidden="true">
    <span v-if="pages > 1" class="absolute inset-0 translate-x-1 -translate-y-0.5 rotate-6 rounded-[3px] bg-white shadow-sm ring-1 ring-black/10" />
    <span class="relative flex size-full flex-col rounded-[3px] bg-white px-1.5 pt-1.5 shadow-sm ring-1 ring-black/10">
      <span class="h-[3px] w-4/5 rounded-full bg-neutral-800" />
      <span class="mt-[2px] h-[2px] w-1/2 rounded-full bg-neutral-400" />
      <span class="my-[3px] h-px w-full bg-neutral-700" />
      <span class="grid grid-cols-[3fr_2fr_2fr_2fr] gap-[3px]">
        <template v-for="row in ROWS" :key="row">
          <span class="h-[2px] w-full rounded-full bg-neutral-700" />
          <span v-for="col in 3" :key="col" :class="['h-[2px] rounded-full bg-neutral-400', widths[(row + col) % ROWS]]" />
        </template>
      </span>
    </span>
  </span>
</template>
