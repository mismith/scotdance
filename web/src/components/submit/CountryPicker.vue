<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Search } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import SearchField from '@/components/admin/SearchField.vue'
import { allCountries, countryChoice, FEATURED } from '@/lib/submitCountries'
import { selectionHaptic } from '@/lib/haptics'
import { useMorph } from '@/lib/morph'

// Where Highland dancing competes, A to Z, one tap each; anywhere else from
// "Another country", searched in a sheet. A choice from there joins the
// list, ticked, so you can see it. The value is a CountryChoice code.
const model = defineModel<string | null>({ default: null })
defineProps<{ labelledby?: string }>()

const choices = computed(() =>
  model.value && !FEATURED.some((c) => c.code === model.value)
    ? [countryChoice(model.value), ...FEATURED]
    : FEATURED,
)

function choose(code: string) {
  selectionHaptic()
  model.value = code
}

// As radios do: one stop for Tab (the chosen one, or the first), and the
// arrows move the choice.
const group = ref<HTMLElement | null>(null)
const tabStop = computed(() =>
  choices.value.some((c) => c.code === model.value)
    ? model.value
    : choices.value[0]?.code,
)
function onArrow(e: KeyboardEvent) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
  if (!step) return
  e.preventDefault()
  const list = choices.value
  const at = list.findIndex((c) => c.code === tabStop.value)
  const next = list[(at + step + list.length) % list.length]
  choose(next.code)
  group.value?.querySelectorAll<HTMLElement>('[role=radio]')[list.indexOf(next)]?.focus()
}

const sheet = useMorph()
const query = ref('')
const q = computed(() => query.value.trim().toLowerCase())
const found = computed(() =>
  allCountries().filter(
    (c) =>
      !q.value ||
      c.name.toLowerCase().includes(q.value) ||
      c.code.toLowerCase() === q.value,
  ),
)
function openSheet(e: Event) {
  query.value = ''
  sheet.show(e)
}
function pickOther(code: string) {
  choose(code)
  sheet.hide()
}

const ROW =
  'press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left'
</script>

<template>
  <div class="surface overflow-hidden rounded-2xl">
    <div
      ref="group"
      role="radiogroup"
      :aria-labelledby="labelledby"
      class="divide-y"
      @keydown="onArrow"
    >
      <button
        v-for="c in choices"
        :key="c.code"
        type="button"
        role="radio"
        :aria-checked="model === c.code"
        :tabindex="c.code === tabStop ? 0 : -1"
        :class="ROW"
        @click="choose(c.code)"
      >
        <span class="w-8 shrink-0 text-center text-2xl leading-none" aria-hidden="true">{{
          c.flag
        }}</span>
        <span
          :class="['min-w-0 flex-1 text-base', model === c.code && 'font-semibold']"
          >{{ c.name }}</span
        >
        <span
          :class="[
            'flex size-[1.375rem] shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-(--dur-quick)',
            model === c.code
              ? 'bg-primary-fill text-primary-foreground'
              : 'shadow-[inset_0_0_0_1.5px_var(--input)]',
          ]"
          aria-hidden="true"
        >
          <Check v-if="model === c.code" class="size-3.5" stroke-width="3" />
        </span>
      </button>
    </div>
    <button type="button" :class="[ROW, 'text-primary border-t']" @click="openSheet">
      <span class="flex w-8 shrink-0 justify-center" aria-hidden="true"
        ><Search class="size-5"
      /></span>
      <span class="flex-1 text-base font-semibold">Another country</span>
    </button>
  </div>

  <Dialog
    :open="sheet.open"
    :morph="sheet"
    variant="sheet"
    size="md"
    @close="sheet.hide()"
  >
    <template #header>
      <h2 class="text-title">Another country</h2>
    </template>
    <div class="p-4 pt-1">
      <SearchField v-model="query" label="Find a country" />
    </div>
    <ul class="divide-y pb-[calc(0.5rem+var(--safe-bottom))]">
      <li v-for="c in found" :key="c.code">
        <button type="button" :class="ROW" @click="pickOther(c.code)">
          <span
            class="w-8 shrink-0 text-center text-2xl leading-none"
            aria-hidden="true"
            >{{ c.flag }}</span
          >
          <span class="min-w-0 flex-1 text-base">{{ c.name }}</span>
          <Check
            v-if="model === c.code"
            class="text-primary size-5 shrink-0"
            aria-label="Chosen"
          />
        </button>
      </li>
      <li v-if="!found.length" class="text-muted-foreground px-4 py-3 text-sm">
        Nothing matches “{{ query.trim() }}”.
      </li>
    </ul>
  </Dialog>
</template>
