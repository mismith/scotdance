<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Check, ChevronDown, Search, X } from '@lucide/vue'
import DateTile from '@/components/DateTile.vue'
import Dialog from '@/components/Dialog.vue'
import ChoiceSummary from '@/components/search/ChoiceSummary.vue'
import { useMorph } from '@/lib/morph'
import { selectionHaptic } from '@/lib/haptics'
import { parseDate } from '@/lib/format'
import { useMeStore } from '@/stores/me'
import { matches, sections, type CompetitionChoice } from './choices'

// Which competition number search looks in: a compact chip under the number
// (the number comes first), which grows into a sheet of every competition
// near today, filtered as you type, so nobody scrolls through dozens.
const props = defineProps<{
  /** Likeliest first (see compareChoices). */
  choices: CompetitionChoice[]
}>()
const model = defineModel<string>({ required: true })
const me = useMeStore()

const labelId = useId()
const chipId = useId()
const chosen = computed(() => props.choices.find((c) => c.id === model.value) ?? null)
const shortDate = (c: CompetitionChoice) =>
  c.competition.date ? parseDate(c.competition.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBA'

const sheet = useMorph()
const query = ref('')
const filtered = computed(() => props.choices.filter((c) => matches(c, query.value)))
const grouped = computed(() => sections(filtered.value))
function openSheet(e: Event) {
  query.value = ''
  sheet.show(e)
}
function pick(id: string) {
  if (id !== model.value) selectionHaptic()
  model.value = id
  sheet.hide()
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <span :id="labelId" class="text-muted-foreground shrink-0 text-sm">Looking in</span>
    <button
      v-if="chosen"
      :id="chipId"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="sheet.open"
      :aria-labelledby="`${labelId} ${chipId}`"
      class="press surface flex h-11 min-w-0 items-center gap-2 rounded-full pr-3 pl-1.5"
      @click="openSheet"
    >
      <span
        :class="[
          'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-footnote font-semibold',
          chosen.today ? 'bg-live-paper text-live' : 'bg-muted text-muted-foreground',
        ]"
      >
        <span v-if="chosen.today" class="bg-live size-1.5 rounded-full" aria-hidden="true" />
        {{ chosen.today ? 'Today' : shortDate(chosen) }}
      </span>
      <span class="truncate text-callout font-semibold">{{ chosen.competition.name ?? 'Competition' }}</span>
      <ChevronDown class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
    </button>

    <Dialog :open="sheet.open" :morph="sheet" variant="sheet" size="md" @close="sheet.hide()">
      <template #header>
        <h2 class="text-title">Choose a competition</h2>
      </template>
      <!-- A steady height, so the box doesn't move while typing shrinks the list. -->
      <div class="min-h-[calc(100svh-8rem)] md:min-h-[min(32rem,60vh)]">
        <div class="bg-raised sticky top-0 z-10 px-4 pt-3 pb-2">
          <label class="field flex h-12 items-center gap-2 rounded-xl pr-1 pl-3">
            <Search class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
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
              class="text-muted-foreground press flex size-11 shrink-0 items-center justify-center rounded-full"
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
              <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
                <li v-for="c in s.choices" :key="c.id">
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="c.id === model"
                    class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2.5 pr-3 pl-4 text-left"
                    @click="pick(c.id)"
                  >
                    <DateTile :date="c.competition.date" :managed="me.organises(c.id)" :today="c.today" />
                    <ChoiceSummary :choice="c" />
                    <Check v-if="c.id === model" class="text-primary size-5 shrink-0" stroke-width="2.5" aria-hidden="true" />
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
