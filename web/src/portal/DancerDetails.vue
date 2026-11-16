<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Pencil, X, LoaderCircle } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { fetchTownSuggestions, placesAvailable, resolveTown, type PlaceSuggestion } from '@/lib/maps'
import { countryNames, needsRegion, placeLabel, PROVINCES, STATES } from './places'
import { tidy } from './profileFields'
type Place = { town: string; province: string; country: string }
type Detail = 'category' | 'studio' | 'location'
const props = withDefaults(defineProps<{ fields?: Detail[] }>(), { fields: () => ['category', 'studio', 'location'] })
const model = defineModel<{ category?: string; studio: string; location?: Place }>({ required: true })
const emit = defineEmits<{ changed: [field: Detail] }>()
const active = ref<Detail | null>(null)
const panel = ref<HTMLElement>()
const value = ref('')
const location = ref<Place>({ town: '', province: '', country: 'Canada' })
const manual = ref(!placesAvailable)
const suggestions = ref<PlaceSuggestion[]>([])
const highlighted = ref(-1)
const searching = ref(false)
const choosing = ref(false)
const failed = ref(false)
const issue = ref('')
const id = useId()
let request = 0
let timer: ReturnType<typeof setTimeout> | undefined
const field = 'field mt-1.5 h-12 w-full rounded-xl px-3 text-base'
const labels = { category: 'Category', studio: 'Teacher studio', location: 'City' }
const categories = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier']
const display = computed(() => ({ category: model.value.category, studio: model.value.studio,
  location: model.value.location ? placeLabel(model.value.location) : '' }))
const countries = computed(() => [...new Set([...countryNames(), location.value.country].filter(Boolean))])
const regions = computed(() => location.value.country === 'Canada' ? PROVINCES : STATES)
const complete = () => !!location.value.town.trim() && !!location.value.country && (!needsRegion(location.value.country) || !!location.value.province)
function stopSearch() { request++; clearTimeout(timer); suggestions.value = []; searching.value = false; highlighted.value = -1 }
async function edit(key: Detail) {
  if (active.value && !commitPending()) return
  stopSearch()
  active.value = key
  value.value = ''
  location.value = { town: '', province: '', country: model.value.location?.country || 'Canada' }
  manual.value = !placesAvailable
  failed.value = false
  issue.value = ''
  await nextTick()
  panel.value?.querySelector<HTMLElement>('input, [aria-pressed="true"], .category-option')?.focus()
}
function close() { stopSearch(); active.value = null; issue.value = '' }
function commitPending(): boolean {
  const key = active.value
  if (!key) return true
  if (key === 'studio' && value.value.trim()) {
    model.value.studio = tidy(value.value)
    emit('changed', key)
  } else if (key === 'location' && (location.value.town.trim() || value.value.trim())) {
    if (!complete()) { issue.value = manual.value ? 'Enter a city, country and region where required.' : 'Choose a city or enter it manually.'; return false }
    model.value.location = { ...location.value, town: tidy(location.value.town) }
    emit('changed', key)
  }
  close()
  return true
}
function leave(event: FocusEvent) {
  const next = event.relatedTarget as HTMLElement | null
  if (next?.closest('[data-cancel-detail]') || (next && panel.value?.contains(next))) return
  if (active.value === 'studio' || (active.value === 'location' && manual.value && complete())) commitPending()
}
watch(value, (query) => {
  stopSearch()
  if (active.value !== 'location' || manual.value || query.trim().length < 2) return
  const version = request
  searching.value = true
  timer = setTimeout(async () => {
    try { const result = await fetchTownSuggestions(query); if (version === request) { suggestions.value = result; highlighted.value = result.length ? 0 : -1 } }
    catch { if (version === request) { failed.value = true; manual.value = true; location.value.town = query.trim() } }
    finally { if (version === request) searching.value = false }
  }, 250)
})
async function choose(suggestion: PlaceSuggestion) {
  stopSearch()
  const version = request
  choosing.value = true
  try {
    const result = await resolveTown(suggestion.placeId)
    if (version === request) { location.value = result; if (complete()) commitPending(); else manual.value = true }
  } catch { if (version === request) { failed.value = true; manual.value = true; location.value.town = suggestion.primaryText } }
  finally { choosing.value = false }
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (suggestions.value.length) highlighted.value = (highlighted.value + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.value.length) % suggestions.value.length
  }
  if (event.key === 'Enter') { event.preventDefault(); const picked = suggestions.value[highlighted.value]; if (picked) void choose(picked) }
}
async function typeManually() {
  stopSearch(); manual.value = true; location.value.town = value.value.trim()
  await nextTick(); panel.value?.querySelector<HTMLInputElement>('input')?.focus()
}
function clearDetail() {
  if (active.value === 'location') model.value.location = { town: '', province: '', country: '' }
  else if (active.value === 'studio') model.value.studio = ''
  if (active.value) emit('changed', active.value)
  close()
}
defineExpose({ commitPending })
onBeforeUnmount(stopSearch)
</script>
<template>
  <div>
    <div class="grid gap-2" :class="props.fields.length === 2 ? 'grid-cols-2' : 'grid-cols-3'">
      <button v-for="key in props.fields" :key="key" type="button" :title="display[key] || labels[key]"
        class="press-row field min-w-0 rounded-xl px-3 py-3 text-left" :aria-expanded="active === key"
        :aria-label="`Edit ${labels[key].toLowerCase()}: ${display[key] || 'Not set'}`" @click="edit(key)">
        <span class="block text-xs text-muted-foreground">{{ labels[key] }}</span>
        <span class="flex items-center gap-1"><span class="min-w-0 flex-1 truncate text-callout">{{ display[key] || 'Not set' }}</span><Pencil class="size-3 shrink-0 text-primary" aria-hidden="true" /></span>
      </button>
    </div>
    <div v-if="active" ref="panel" class="mt-3 rounded-xl border border-border p-3" @focusout="leave" @keydown.esc.stop.prevent="close">
      <div class="mb-1 flex items-center justify-between gap-2">
        <span class="font-semibold">{{ labels[active] }}</span>
        <button type="button" data-cancel-detail class="press-row -mr-2 flex size-11 items-center justify-center rounded-full" aria-label="Cancel detail changes" @click="close"><X class="size-5" aria-hidden="true" /></button>
      </div>
      <div v-if="active === 'category'" class="flex flex-wrap gap-2">
        <Button v-for="category in ['', ...categories]" :key="category" class="category-option" :aria-pressed="model.category === category" :variant="model.category === category ? 'primary' : 'secondary'" @click="model.category = category; emit('changed', 'category'); close()">{{ category || 'Not set' }}</Button>
      </div>
      <template v-else-if="active === 'studio'">
        <input v-model="value" aria-label="Teacher or studio" :class="field" maxlength="120" autocomplete="off" @keydown.enter.prevent="commitPending" />
        <Button v-if="model.studio" variant="plain" @click="clearDetail">Clear studio</Button>
      </template>
      <template v-else>
        <template v-if="!manual">
          <div class="relative">
            <input v-model="value" aria-label="Search for a city" :class="[field, 'pr-10']" role="combobox" autocomplete="off" maxlength="120" aria-autocomplete="list" :aria-controls="`${id}-suggestions`" :aria-expanded="!!suggestions.length" :aria-activedescendant="highlighted >= 0 ? `${id}-${highlighted}` : undefined" :disabled="choosing" @keydown="keydown" />
            <LoaderCircle v-if="searching || choosing" class="absolute right-3 top-5 size-5 animate-spin text-primary" aria-label="Finding cities" />
          </div>
          <ul v-if="suggestions.length" :id="`${id}-suggestions`" role="listbox" aria-label="Cities" class="mt-1 overflow-hidden rounded-xl border border-border">
            <li v-for="(suggestion, index) in suggestions" :id="`${id}-${index}`" :key="suggestion.placeId" role="option" :aria-selected="index === highlighted" class="press-row cursor-pointer px-3 py-2" :class="{ 'bg-blue-paper': index === highlighted }" @mousedown.prevent @click="choose(suggestion)">
              <span class="block font-semibold">{{ suggestion.primaryText }}</span><span class="text-sm text-muted-foreground">{{ suggestion.secondaryText }}</span>
            </li>
          </ul>
          <div class="flex flex-wrap items-center justify-between gap-x-2">
            <Button variant="plain" size="sm" class="-ml-3.5" @click="typeManually">Enter city manually</Button>
            <span v-if="suggestions.length" class="text-xs text-muted-foreground">Powered by Google</span>
          </div>
        </template>
        <div v-else class="grid grid-cols-2 gap-3" @keydown.enter.prevent="commitPending">
          <p v-if="failed" class="col-span-2 text-sm text-muted-foreground">City search is unavailable. Enter your city below.</p>
          <label class="col-span-2">City<input v-model="location.town" :class="field" maxlength="120" /></label>
          <label v-if="needsRegion(location.country)">{{ location.country === 'Canada' ? 'Province' : 'State' }}<select v-model="location.province" :class="field"><option value="">Choose…</option><option v-for="region in regions" :key="region.code" :value="region.code">{{ region.name }}</option></select></label>
          <label v-else>Region (optional)<input v-model="location.province" :class="field" maxlength="120" /></label>
          <label>Country<select v-model="location.country" :class="field" @change="location.province = ''"><option v-for="country in countries" :key="country">{{ country }}</option></select></label>
        </div>
        <Button v-if="model.location?.town" variant="plain" size="sm" @click="clearDetail">Clear city</Button>
      </template>
      <p v-if="issue" role="alert" class="mt-2 text-sm text-destructive">{{ issue }}</p>
    </div>
  </div>
</template>
