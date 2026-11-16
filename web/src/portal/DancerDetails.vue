<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Pencil, X } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { fetchTownSuggestions, placesAvailable, resolveTown, type PlaceSuggestion } from '@/lib/maps'
import type { Dancer } from './account'
const model = defineModel<Dancer>({ required: true })
type Detail = 'category' | 'studio' | 'location'
const active = ref<Detail | null>(null)
const panel = ref<HTMLElement>()
const value = ref('')
const location = ref({ town: '', province: '', country: '' })
const manual = ref(!placesAvailable)
const suggestions = ref<PlaceSuggestion[]>([])
const highlighted = ref(-1)
const searching = ref(false)
const choosing = ref(false)
const failed = ref(false)
let request = 0
let timer: ReturnType<typeof setTimeout> | undefined
const field = 'field mt-1.5 h-12 w-full rounded-xl px-3 text-base'
const labels = { category: 'Category', studio: 'Studio', location: 'City' }
const categories = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier']
const display = computed(() => ({ category: model.value.category, studio: model.value.studio,
  location: [model.value.location?.town, model.value.location?.province].filter(Boolean).join(', ') }))
function stopSearch() {
  request++
  clearTimeout(timer)
  suggestions.value = []
  searching.value = false
  highlighted.value = -1
}
async function edit(key: Detail) {
  stopSearch()
  active.value = key
  value.value = key === 'location' ? '' : model.value[key] ?? ''
  location.value = { town: '', province: '', country: '', ...model.value.location }
  manual.value = !placesAvailable
  failed.value = false
  await nextTick()
  panel.value?.querySelector<HTMLElement>('input, button')?.focus()
}
function close() { stopSearch(); active.value = null }
function commit() {
  if (active.value === 'location') model.value.location = { ...location.value }
  else if (active.value) model.value[active.value] = value.value.trim()
  close()
}
watch(value, (query) => {
  stopSearch()
  if (active.value !== 'location' || manual.value || query.trim().length < 2) return
  const version = request
  searching.value = true
  timer = setTimeout(async () => {
    try {
      const result = await fetchTownSuggestions(query)
      if (version === request) suggestions.value = result
    } catch {
      if (version === request) failed.value = true
    } finally {
      if (version === request) searching.value = false
    }
  }, 250)
})
async function choose(suggestion: PlaceSuggestion) {
  stopSearch()
  const version = request
  choosing.value = true
  try {
    const result = await resolveTown(suggestion.placeId)
    if (version === request) {
      location.value = result
      commit()
    }
  } catch {
    if (version === request) { failed.value = true; manual.value = true }
  } finally { choosing.value = false }
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (suggestions.value.length) highlighted.value = (highlighted.value + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.value.length) % suggestions.value.length
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const picked = suggestions.value[highlighted.value]
    if (picked) void choose(picked)
  }
}
defineExpose({ commitPending: () => { if (active.value === 'studio' || (active.value === 'location' && manual.value)) commit() } })
onBeforeUnmount(stopSearch)
</script>
<template>
  <div>
    <div class="grid grid-cols-3 gap-2">
      <button v-for="key in (['category', 'studio', 'location'] as const)" :key="key" type="button"
        class="press-row field min-w-0 rounded-xl px-3 py-3 text-left" :aria-expanded="active === key"
        :aria-label="`Edit ${labels[key].toLowerCase()}: ${display[key] || 'Not set'}`" @click="edit(key)">
        <span class="block text-xs text-muted-foreground">{{ labels[key] }}</span>
        <span class="flex items-center gap-1"><span class="min-w-0 flex-1 truncate text-callout">{{ display[key] || 'Not set' }}</span><Pencil class="size-3 shrink-0 text-primary" aria-hidden="true" /></span>
      </button>
    </div>
    <div v-if="active" ref="panel" class="mt-3 space-y-3 rounded-xl border border-border p-4" @keydown.esc.prevent="close">
      <div class="flex items-center justify-between gap-2">
        <span class="font-semibold">{{ labels[active] }} <span class="font-normal text-muted-foreground">(optional)</span></span>
        <button type="button" class="press-row -mr-2 flex size-11 items-center justify-center rounded-full" aria-label="Cancel detail changes" @click="close"><X class="size-5" aria-hidden="true" /></button>
      </div>
      <template v-if="active === 'category'">
        <div class="flex flex-wrap gap-2">
          <Button v-for="category in ['', ...categories]" :key="category" :variant="value === category ? 'primary' : 'secondary'" @click="value = category; commit()">{{ category || 'Not set' }}</Button>
        </div>
      </template>
      <template v-else-if="active === 'studio'">
        <label class="block">Teacher or studio<input v-model="value" :class="field" maxlength="120" @keydown.enter.prevent="commit" /></label>
        <Button @click="commit">Done</Button>
      </template>
      <template v-else>
        <template v-if="!manual">
          <label class="block">Search for a city<input v-model="value" :class="field" role="combobox" autocomplete="off" maxlength="120" aria-autocomplete="list" aria-controls="town-suggestions" :aria-expanded="!!suggestions.length" :aria-activedescendant="highlighted >= 0 ? `town-${highlighted}` : undefined" :disabled="choosing" @keydown="keydown" /></label>
          <ul v-if="suggestions.length" id="town-suggestions" role="listbox" aria-label="Cities" class="overflow-hidden rounded-xl border border-border">
            <li v-for="(suggestion, index) in suggestions" :id="`town-${index}`" :key="suggestion.placeId" role="option" :aria-selected="index === highlighted" class="press-row cursor-pointer px-3 py-2" :class="{ 'bg-blue-paper': index === highlighted }" @mousedown.prevent @click="choose(suggestion)">
              <span class="block font-semibold">{{ suggestion.primaryText }}</span><span class="text-sm text-muted-foreground">{{ suggestion.secondaryText }}</span>
            </li>
          </ul>
          <p role="status" class="min-h-5 text-sm text-muted-foreground">{{ choosing ? 'Choosing city…' : searching ? 'Finding cities…' : failed ? 'City search is unavailable. Enter your city manually below.' : value.length >= 2 && !suggestions.length ? 'No cities found. You can enter yours manually.' : '' }}</p>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <Button variant="plain" @click="stopSearch(); manual = true">Enter city manually</Button>
            <span v-if="suggestions.length" class="text-xs text-muted-foreground">Powered by Google</span>
          </div>
        </template>
        <template v-else>
          <label class="block">City<input v-model="location.town" :class="field" maxlength="120" /></label>
          <label class="block">Province or region<input v-model="location.province" :class="field" maxlength="120" /></label>
          <label class="block">Country<input v-model="location.country" :class="field" maxlength="120" /></label>
          <Button @click="commit">Done</Button>
        </template>
        <Button v-if="model.location?.town" variant="plain" @click="location = { town: '', province: '', country: '' }; commit()">Clear city</Button>
      </template>
    </div>
  </div>
</template>
