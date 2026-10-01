<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { Check, ChevronRight, Search, X } from '@lucide/vue'
import DateTile from '@/components/DateTile.vue'
import Dialog from '@/components/Dialog.vue'
import ChoiceSummary from '@/components/search/ChoiceSummary.vue'
import { useMorph } from '@/lib/morph'
import { useMeStore } from '@/stores/me'
import { matches, sections, shortlist, type CompetitionChoice } from './choices'

// Which competition number search looks in, as cards with a date tile: the
// likeliest few in a row (one tap to switch), and the rest in a sheet that
// filters as you type, so nobody scrolls through dozens.
const props = defineProps<{
  /** Likeliest first (see compareChoices). */
  choices: CompetitionChoice[]
}>()
const model = defineModel<string>({ required: true })
const me = useMeStore()

const labelId = useId()

// One picked from the full list (or opened from a link) joins the front of
// the row and stays there, so switching back is one tap.
const kept = ref<string[]>([])
const row = computed(() => shortlist(props.choices, kept.value))
watch(
  [model, () => props.choices],
  ([id]) => {
    if (props.choices.some((c) => c.id === id) && !row.value.some((c) => c.id === id)) {
      kept.value = [id, ...kept.value].slice(0, 2)
    }
  },
  { immediate: true },
)
const more = computed(() => props.choices.length > row.value.length)

// A radio group: Tab lands on the chosen card, arrows move between them.
const rowEl = ref<HTMLElement | null>(null)
const focusable = computed(() => (row.value.some((c) => c.id === model.value) ? model.value : row.value[0]?.id))
const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
function onRowKeydown(e: KeyboardEvent) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const at = row.value.findIndex((c) => c.id === model.value)
  const last = row.value.length - 1
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? last : e.key in STEP ? at + STEP[e.key] : null
  if (to == null) return
  e.preventDefault()
  const i = to < 0 ? last : to > last ? 0 : to
  model.value = row.value[i].id
  void nextTick(() => rowEl.value?.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus())
}

// A new choice pops its check (not the one the page opens on), and stays in
// view: sideways only, so the page stays put.
const changed = ref(false)
watch(model, async () => {
  changed.value = true
  await nextTick()
  const box = rowEl.value
  const card = box?.querySelector<HTMLElement>('[aria-checked="true"]')
  if (!box || !card || box.scrollWidth <= box.clientWidth) return
  const pad = parseFloat(getComputedStyle(box).paddingLeft) || 0
  if (card.offsetLeft - pad < box.scrollLeft || card.offsetLeft + card.offsetWidth > box.scrollLeft + box.clientWidth) {
    box.scrollTo({ left: card.offsetLeft - pad })
  }
})

// Every competition near today, filtered by what's typed.
const sheet = useMorph()
const query = ref('')
const filtered = computed(() => props.choices.filter((c) => matches(c, query.value)))
const grouped = computed(() => sections(filtered.value))
function openSheet(e: Event) {
  query.value = ''
  sheet.show(e)
}
function pick(id: string) {
  model.value = id
  sheet.hide()
}
</script>

<template>
  <div class="space-y-1">
    <div class="flex min-h-6 flex-wrap items-center justify-between gap-x-3">
      <span :id="labelId" class="text-muted-foreground text-sm font-bold whitespace-nowrap">Looking in</span>
      <button
        v-if="more"
        type="button"
        aria-haspopup="dialog"
        class="text-primary -my-2.5 -mr-2 ml-auto flex h-11 items-center gap-0.5 rounded-full pr-1 pl-3 text-[0.9375rem] font-bold whitespace-nowrap"
        @click="openSheet"
      >
        More competitions
        <ChevronRight class="size-4" />
      </button>
    </div>

    <div
      ref="rowEl"
      role="radiogroup"
      :aria-labelledby="labelId"
      class="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] motion-safe:scroll-smooth md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
      @keydown="onRowKeydown"
    >
      <button
        v-for="c in row"
        :key="c.id"
        v-tap-feedback
        type="button"
        role="radio"
        :aria-checked="c.id === model"
        :tabindex="c.id === focusable ? 0 : -1"
        :class="[
          'relative flex w-60 max-w-[calc(100vw-4rem)] shrink-0 snap-start items-center gap-3 rounded-2xl border p-3 text-left transition-colors md:w-auto md:max-w-none',
          c.id === model ? 'bg-blue-paper border-primary ring-primary ring-1' : 'bg-card hover:bg-accent shadow-sm',
        ]"
        @click="model = c.id"
      >
        <DateTile :date="c.competition.date" :managed="me.hasCompetitionPerm(c.id)" />
        <ChoiceSummary :choice="c" />
        <span
          v-if="c.id === model"
          :class="[
            'bg-primary text-primary-foreground ring-background absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full ring-2',
            changed && 'motion-safe:animate-pop',
          ]"
          aria-hidden="true"
        >
          <Check class="size-4" stroke-width="3" />
        </span>
      </button>
    </div>

    <Dialog :open="sheet.open" :morph="sheet" variant="sheet" size="md" @close="sheet.hide()">
      <template #header>
        <h2 class="text-title">Choose a competition</h2>
      </template>
      <!-- A steady height, so the box doesn't move while typing shrinks the list. -->
      <div class="min-h-[calc(100svh-8rem)] md:min-h-[min(32rem,60vh)]">
        <div class="bg-card sticky top-0 z-10 px-4 pt-4 pb-2">
          <label class="bg-card border-strong focus-within:border-primary flex h-12 items-center gap-2 rounded-xl border-2 px-3">
            <Search class="text-muted-foreground size-5 shrink-0" />
            <input
              v-model="query"
              type="search"
              enterkeyhint="go"
              autocomplete="off"
              placeholder="Name or town"
              aria-label="Find a competition"
              class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
              @keydown.enter.prevent="query.trim() && filtered[0] && pick(filtered[0].id)"
            />
            <button
              v-if="query"
              type="button"
              class="text-muted-foreground -mr-1 flex size-7 items-center justify-center rounded-full"
              aria-label="Clear"
              @click="query = ''"
            >
              <X class="size-5" />
            </button>
          </label>
        </div>
        <div class="space-y-4 px-4 pt-2 pb-[calc(1.5rem+var(--safe-bottom))]">
          <div v-if="filtered.length" role="radiogroup" aria-label="Competitions" class="space-y-4">
            <section v-for="s in grouped" :key="s.key" class="space-y-2">
              <h3 :class="['text-heading', s.key === 'today' && 'text-live']">{{ s.label }}</h3>
              <ul class="divide-y overflow-hidden rounded-2xl border">
                <li v-for="c in s.choices" :key="c.id">
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="c.id === model"
                    class="bg-card hover:bg-accent flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left"
                    @click="pick(c.id)"
                  >
                    <DateTile :date="c.competition.date" :managed="me.hasCompetitionPerm(c.id)" />
                    <ChoiceSummary :choice="c" />
                    <Check v-if="c.id === model" class="text-primary size-5 shrink-0" stroke-width="3" />
                  </button>
                </li>
              </ul>
            </section>
          </div>
          <p v-else class="text-muted-foreground py-4 text-center text-base">No competition matches “{{ query }}”.</p>
          <p class="text-muted-foreground text-center text-sm">Showing competitions within a month of today.</p>
        </div>
      </div>
    </Dialog>
  </div>
</template>
