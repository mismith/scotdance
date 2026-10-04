<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { MapPin } from '@lucide/vue'
import AdminField from '@/components/admin/AdminField.vue'
import SaveMark from '@/components/admin/SaveMark.vue'
import { useAutosave } from '@/composables/admin/useAutosave'
import {
  fetchVenueSuggestions,
  resolveVenue,
  type PlaceSuggestion,
  type VenueFields,
} from '@/lib/maps'

// The venue's name, which also searches for it: choosing a suggestion fills
// in the address, town and map position (`pick`). Whatever's typed and not
// chosen stays as the name. Given `save`, the name saves itself like any
// other field in Manage (shortly after typing stops, on Enter, on leaving;
// Escape puts it back); without, it's a plain v-model (as in Submit).

const model = defineModel<string | null | undefined>({ default: '' })
const props = defineProps<{ save?: (value: string) => unknown }>()
const emit = defineEmits<{ pick: [fields: VenueFields] }>()

const id = useId()
const LABEL = 'Venue name'
const saved = props.save
  ? useAutosave({
      value: () => model.value,
      save: (v) => props.save!(v),
      label: () => LABEL,
    })
  : null
const text = computed(() => (saved ? saved.draft.value : (model.value ?? '')))

const results = ref<PlaceSuggestion[]>([])
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
    const found = await fetchVenueSuggestions(q)
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
  clearTimeout(timer)
  timer = setTimeout(() => void search(q), 300)
}
function close() {
  clearTimeout(timer)
  latest++
  results.value = []
  active.value = -1
  loading.value = false
}
onBeforeUnmount(close)

async function pick(s: PlaceSuggestion) {
  close()
  loading.value = true
  try {
    const fields = await resolveVenue(s.placeId)
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

function onKeydown(e: KeyboardEvent) {
  if (results.value.length && e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % results.value.length
  } else if (results.value.length && e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter' && !e.isComposing && (results.value.length || saved)) {
    // Choose the highlighted one, or keep what's typed (Enter again moves on).
    e.preventDefault()
    if (active.value >= 0 && results.value.length) void pick(results.value[active.value])
    else {
      close()
      void saved?.commit()
    }
  } else if (e.key === 'Escape' && (results.value.length || saved?.dirty.value)) {
    e.preventDefault()
    e.stopPropagation()
    if (results.value.length) close()
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
    hint="Choose it from the suggestions to fill in the address and town, and put it on the map."
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
          :aria-expanded="results.length > 0"
          :aria-controls="`${id}-list`"
          :aria-activedescendant="active >= 0 ? `${id}-o${active}` : undefined"
          :aria-invalid="!!saved?.error.value || undefined"
          :disabled="saved?.locked.value"
          autocomplete="off"
          placeholder="e.g. Telus Convention Centre"
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
          v-if="results.length"
          :id="`${id}-list`"
          role="listbox"
          class="surface-raised absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl p-1"
          @mousedown.prevent
        >
          <li
            v-for="(s, i) in results"
            :id="`${id}-o${i}`"
            :key="s.placeId"
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
              @click="pick(s)"
            >
              <MapPin class="text-primary size-4 shrink-0" />
              <span class="min-w-0">
                <span class="block truncate text-base font-medium">{{
                  s.primaryText
                }}</span>
                <span class="text-muted-foreground block truncate text-sm">{{
                  s.secondaryText
                }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </AdminField>
</template>
