<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { LoaderCircle, MapPin, Search } from '@lucide/vue'
import { fetchVenueSuggestions, resolveVenue, type VenueFields } from '@/lib/maps'
import type { PlaceSuggestion } from '@/lib/maps'

// Type a venue or address; choosing a result fills in the venue, address,
// location and map position together.

const emit = defineEmits<{ pick: [fields: VenueFields] }>()

const id = useId()
const query = ref('')
const results = ref<PlaceSuggestion[]>([])
const loading = ref(false)
const active = ref(-1)
const error = ref<string | null>(null)

const search = useDebounceFn(async (q: string) => {
  if (!q.trim()) {
    results.value = []
    return
  }
  loading.value = true
  try {
    results.value = await fetchVenueSuggestions(q)
    error.value = null
  } catch {
    error.value = 'Search isn’t working right now. You can still type the details below.'
    results.value = []
  } finally {
    loading.value = false
  }
}, 300)

watch(query, (q) => {
  active.value = -1
  void search(q)
})

async function pick(s: PlaceSuggestion) {
  loading.value = true
  try {
    emit('pick', await resolveVenue(s.placeId))
    query.value = ''
    results.value = []
  } catch {
    error.value = 'That place couldn’t be looked up. Try another, or type the details below.'
  } finally {
    loading.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter' && active.value >= 0) {
    e.preventDefault()
    void pick(results.value[active.value])
  } else if (e.key === 'Escape') {
    results.value = []
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <label :for="id" class="text-[0.9375rem] font-bold">Find the venue</label>
    <div class="relative">
      <div class="bg-card border-strong focus-within:border-primary flex h-12 items-center gap-2 rounded-xl border-2 px-3">
        <Search class="text-muted-foreground size-4 shrink-0" />
        <input
          :id="id"
          v-model="query"
          type="search"
          role="combobox"
          :aria-expanded="results.length > 0"
          :aria-controls="`${id}-list`"
          :aria-activedescendant="active >= 0 ? `${id}-o${active}` : undefined"
          autocomplete="off"
          placeholder="Search for a hall, school or address"
          class="min-w-0 flex-1 bg-transparent text-base outline-none"
          @keydown="onKeydown"
        />
        <LoaderCircle v-if="loading" class="text-muted-foreground size-4 animate-spin" />
      </div>
      <ul
        v-if="results.length"
        :id="`${id}-list`"
        role="listbox"
        class="bg-popover absolute inset-x-0 top-full z-20 mt-1 divide-y overflow-hidden rounded-xl border shadow-lg"
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
            :class="['flex w-full items-center gap-3 px-3 py-2.5 text-left', i === active ? 'bg-accent' : 'hover:bg-accent']"
            @click="pick(s)"
          >
            <MapPin class="text-primary size-4 shrink-0" />
            <span class="min-w-0">
              <span class="block truncate text-base font-semibold">{{ s.primaryText }}</span>
              <span class="text-muted-foreground block truncate text-sm">{{ s.secondaryText }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
    <p v-if="error" class="text-destructive text-sm font-semibold">{{ error }}</p>
    <p v-else class="text-muted-foreground text-sm">Fills in the details below and puts it on the map.</p>
  </div>
</template>
