<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { MapPin, School } from '@lucide/vue'
import AdminField from '@/components/admin/AdminField.vue'
import SaveMark from '@/components/admin/SaveMark.vue'
import { useAutosave } from '@/composables/admin/useAutosave'
import { useEntityAggregates } from '@/composables/useEntityAggregates'
import {
  knownVenueFields,
  looseVenueName,
  matchKnownVenues,
  townLine,
  type KnownVenueRow,
} from '@/lib/knownVenues'
import {
  fetchVenueSuggestions,
  resolveVenue,
  type PlaceSuggestion,
  type VenueFields,
} from '@/lib/maps'

// The venue's name, which also searches for it: choosing a suggestion fills
// in the address, town and map position (`pick`). Venues the app already
// knows come first, so a competition there joins that venue rather than
// starting another spelled a little differently. Whatever's typed and not
// chosen stays as the name. Given `save`, the name saves itself like any
// other field in Manage (shortly after typing stops, on Enter, on leaving;
// Escape puts it back); without, it's a plain v-model (as in Submit).

const model = defineModel<string | null | undefined>({ default: '' })
const props = defineProps<{
  save?: (value: string) => unknown
  disabled?: boolean
  /** Only places in these countries (ISO, e.g. ['CA']). */
  regionCodes?: string[]
  placeholder?: string
  /** Under the box; null for none (where the page says it already). */
  hint?: string | null
}>()
const emit = defineEmits<{ pick: [fields: VenueFields] }>()

const id = useId()
const LABEL = 'Venue name'
const saved = props.save
  ? useAutosave({
      value: () => model.value,
      save: (v) => props.save!(v),
      label: () => LABEL,
      disabled: () => props.disabled,
    })
  : null
const text = computed(() => (saved ? saved.draft.value : (model.value ?? '')))

const results = ref<PlaceSuggestion[]>([])
const index = useEntityAggregates('venues')
const knownRows = computed<KnownVenueRow[]>(() =>
  index.data.value.map(({ id, agg }) => ({
    id,
    name: String(agg.name ?? ''),
    locality: (agg.locality as string | null) ?? null,
    region: (agg.region as string | null) ?? null,
    country: (agg.country as string | null) ?? null,
    count: agg.appearanceCount ?? 0,
  })),
)
const known = ref<KnownVenueRow[]>([])
type Option = { kind: 'known'; venue: KnownVenueRow } | { kind: 'place'; place: PlaceSuggestion }
// Google's own suggestion of a venue already offered (same name, same town) goes.
const offered = (p: PlaceSuggestion) =>
  known.value.some(
    (k) =>
      looseVenueName(k.name) === looseVenueName(p.primaryText) &&
      !!k.locality &&
      p.secondaryText.toLowerCase().includes(k.locality.toLowerCase()),
  )
const options = computed<Option[]>(() => [
  ...known.value.map((venue) => ({ kind: 'known' as const, venue })),
  ...results.value.filter((p) => !offered(p)).map((place) => ({ kind: 'place' as const, place })),
])
const loading = ref(false)
const active = ref(-1)
const searchError = ref<string | null>(null)
const error = computed(() => searchError.value ?? saved?.error.value ?? null)

// Searches once typing pauses. Answers can arrive out of order: only the
// latest search's counts, and none after the list is closed.
let timer: ReturnType<typeof setTimeout> | undefined
let latest = 0
async function search(q: string) {
  const mine = ++latest
  if (!q.trim()) {
    close()
    return
  }
  loading.value = true
  try {
    const found = await fetchVenueSuggestions(q, props.regionCodes)
    if (mine !== latest) return
    results.value = found
    searchError.value = null
  } catch {
    if (mine !== latest) return
    results.value = []
    searchError.value = 'Search isn’t working right now. Type the details instead.'
  } finally {
    if (mine === latest) loading.value = false
  }
}
function onInput(e: Event) {
  const q = (e.target as HTMLInputElement).value
  if (saved) saved.input(q)
  else model.value = q
  active.value = -1
  known.value = matchKnownVenues(knownRows.value, q, props.regionCodes)
  clearTimeout(timer)
  timer = setTimeout(() => void search(q), 300)
}
function close() {
  clearTimeout(timer)
  latest++
  results.value = []
  known.value = []
  active.value = -1
  loading.value = false
}
onBeforeUnmount(close)

async function pick(o: Option) {
  close()
  loading.value = true
  try {
    const fields = await (o.kind === 'known' ? knownVenueFields(o.venue.id) : resolveVenue(o.place.placeId))
    // What was typed was only the search: the place's own name replaces it.
    if (saved) {
      saved.revert()
      if (fields.venue) saved.draft.value = fields.venue
    }
    emit('pick', fields)
    searchError.value = null
  } catch {
    searchError.value =
      'That venue couldn’t be looked up. Try another, or type the details.'
  } finally {
    loading.value = false
  }
}

// Whether a picked suggestion is still being looked up.
defineExpose({ loading })

function onKeydown(e: KeyboardEvent) {
  const n = options.value.length
  if (n && e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % n
  } else if (n && e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
  } else if (e.key === 'Enter' && !e.isComposing && (n || saved)) {
    // Choose the highlighted one, or keep what's typed (Enter again moves on).
    e.preventDefault()
    if (active.value >= 0 && n) void pick(options.value[active.value])
    else {
      close()
      void saved?.commit()
    }
  } else if (e.key === 'Escape' && (n || saved?.dirty.value)) {
    e.preventDefault()
    e.stopPropagation()
    if (n) close()
    else saved?.revert()
  }
}
function onBlur() {
  close()
  void saved?.commit()
}
</script>

<template>
  <AdminField
    :label="LABEL"
    :for="id"
    :hint="hint === undefined ? 'Choose it from the suggestions to fill in the address and town, and put it on the map.' : (hint ?? undefined)"
    :error="error"
  >
    <template #default="{ describedby }">
      <div class="relative">
        <input
          :id="id"
          :aria-describedby="describedby"
          :value="text"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="options.length > 0"
          :aria-controls="`${id}-list`"
          :aria-activedescendant="active >= 0 ? `${id}-o${active}` : undefined"
          :aria-invalid="!!saved?.error.value || undefined"
          :disabled="saved?.locked.value"
          autocomplete="off"
          :placeholder="placeholder ?? 'e.g. Telus Convention Centre'"
          :class="[
            'h-12 w-full rounded-xl pr-10 pl-3 text-base',
            saved?.locked.value
              ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-[inset_0_0_0_1px_var(--border)]'
              : 'field',
          ]"
          @input="onInput"
          @keydown="onKeydown"
          @blur="onBlur"
        />
        <span
          class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2"
          aria-hidden="true"
        >
          <SaveMark :status="loading ? 'saving' : (saved?.status.value ?? 'idle')" />
        </span>
        <!-- Pressing a suggestion mustn't blur the box first (that closes the list). -->
        <ul
          v-if="options.length"
          :id="`${id}-list`"
          role="listbox"
          class="frosted-paper menu-edge absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl p-1"
          @mousedown.prevent
        >
          <li
            v-for="(o, i) in options"
            :id="`${id}-o${i}`"
            :key="o.kind === 'known' ? o.venue.id : o.place.placeId"
            role="option"
            :aria-selected="i === active"
          >
            <button
              type="button"
              tabindex="-1"
              :class="[
                'press-row flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left',
                i === active && '[--row-tint:var(--tint-hover)]',
              ]"
              @click="pick(o)"
            >
              <template v-if="o.kind === 'known'">
                <School class="text-primary size-4 shrink-0" />
                <span class="min-w-0">
                  <span class="block truncate text-base font-medium">{{ o.venue.name }}</span>
                  <span class="text-muted-foreground block truncate text-sm">{{
                    [townLine(o.venue.locality, o.venue.region), o.venue.count === 1 ? '1 competition' : `${o.venue.count} competitions`].filter(Boolean).join(' · ')
                  }}</span>
                </span>
              </template>
              <template v-else>
                <MapPin class="text-primary size-4 shrink-0" />
                <span class="min-w-0">
                  <span class="block truncate text-base font-medium">{{
                    o.place.primaryText
                  }}</span>
                  <span class="text-muted-foreground block truncate text-sm">{{
                    o.place.secondaryText
                  }}</span>
                </span>
              </template>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </AdminField>
</template>
