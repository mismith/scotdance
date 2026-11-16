<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Search, LoaderCircle, X } from '@lucide/vue'
import { fetchTownSuggestions, resolveTown, placesAvailable, type PlaceSuggestion } from '@/lib/maps'
import { countryNames, needsRegion, placeLabel, PROVINCES, STATES } from './places'
import { tidy } from './profileFields'
type Place = { town: string; province: string; country: string }
const props = defineProps<{ modelValue?: Place }>()
const emit = defineEmits<{ 'update:modelValue': [value: Place]; changed: [] }>()
const query = ref(props.modelValue ? placeLabel(props.modelValue) : '')
const manual = ref(!placesAvailable)
const draft = ref<Place>({ town: '', province: '', country: 'Canada', ...props.modelValue })
const suggestions = ref<PlaceSuggestion[]>([])
const active = ref(-1)
const busy = ref(false)
const error = ref('')
const input = ref<HTMLInputElement>()
const root = ref<HTMLElement>()
const id = useId()
let timer: ReturnType<typeof setTimeout> | undefined
let request = 0
const field = 'field mt-1.5 h-12 w-full rounded-xl px-3 text-base'
const regions = computed(() => draft.value.country === 'Canada' ? PROVINCES : STATES)
const countries = computed(() => [...new Set([...countryNames(), draft.value.country].filter(Boolean))])
function stop() { request++; clearTimeout(timer); busy.value = false; suggestions.value = []; active.value = -1 }
watch(() => props.modelValue, place => {
  query.value = place ? placeLabel(place) : ''
  draft.value = { town: '', province: '', country: 'Canada', ...place }
}, { deep: true })
function search() {
  stop(); error.value = ''
  const version = request, text = query.value.trim()
  if (text.length < 2) return
  busy.value = true
  timer = setTimeout(async () => {
    try { const found = await fetchTownSuggestions(text); if (request === version) { suggestions.value = found; active.value = found.length ? 0 : -1 } }
    catch { if (request === version) { manual.value = true; draft.value.town = text; error.value = 'Search is unavailable. Enter your city below.' } }
    finally { if (request === version) busy.value = false }
  }, 250)
}
function publish(place: Place) {
  emit('update:modelValue', place); emit('changed'); query.value = placeLabel(place); stop(); error.value = ''
}
async function pick(suggestion: PlaceSuggestion) {
  stop(); const version = request; busy.value = true
  try {
    const place = await resolveTown(suggestion.placeId)
    if (request !== version) return
    draft.value = place
    if (place.town && place.country && (!needsRegion(place.country) || place.province)) { manual.value = false; publish(place) }
    else manual.value = true
  } catch { if (request === version) { manual.value = true; draft.value.town = suggestion.primaryText; error.value = 'Enter the city details below.' } }
  finally { if (request === version) busy.value = false }
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') { stop(); query.value = props.modelValue ? placeLabel(props.modelValue) : ''; return }
  if (['ArrowDown','ArrowUp'].includes(event.key) && suggestions.value.length) { event.preventDefault(); active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.value.length) % suggestions.value.length }
  if (event.key === 'Enter') { event.preventDefault(); const item = suggestions.value[active.value]; if (item) void pick(item) }
}
async function typeManually() { stop(); draft.value = { town: query.value === (props.modelValue ? placeLabel(props.modelValue) : '') ? props.modelValue?.town || '' : query.value.trim(), province: '', country: props.modelValue?.country || 'Canada' }; manual.value = true; await nextTick(); root.value?.querySelector<HTMLInputElement>('input')?.focus() }
function settle(event?: FocusEvent) {
  if (event?.relatedTarget && root.value?.contains(event.relatedTarget as Node)) return
  if (!manual.value) { stop(); query.value = props.modelValue ? placeLabel(props.modelValue) : ''; return }
  if (!draft.value.town.trim() || !draft.value.country || (needsRegion(draft.value.country) && !draft.value.province)) return
  const place = { ...draft.value, town: tidy(draft.value.town) }
  if (JSON.stringify(place) !== JSON.stringify(props.modelValue)) publish(place)
}
function clear() { manual.value = false; publish({ town: '', province: '', country: '' }) }
onBeforeUnmount(stop)
</script>
<template>
  <div ref="root" class="min-w-0" @focusout="settle">
    <label v-if="!manual" :for="id" class="text-callout font-medium">City</label>
    <div v-if="!manual" class="relative">
      <Search class="absolute left-3 top-3.5 size-5 text-primary" aria-hidden="true" />
      <input :id="id" ref="input" v-model="query" :class="[field, 'pl-10 pr-10']" placeholder="Search for a city" role="combobox" autocomplete="off" maxlength="120" aria-autocomplete="list" :aria-controls="`${id}-list`" :aria-expanded="!!suggestions.length" :aria-activedescendant="active >= 0 ? `${id}-${active}` : undefined" @input="search" @keydown="key" />
      <LoaderCircle v-if="busy" class="absolute right-3 top-3.5 size-5 animate-spin text-primary" aria-label="Finding cities" />
      <button v-else-if="props.modelValue?.town" type="button" class="absolute right-1 top-0 flex size-12 items-center justify-center text-muted-foreground" aria-label="Clear city" @click="clear"><X class="size-4" aria-hidden="true" /></button>
    </div>
    <ul v-if="!manual && suggestions.length" :id="`${id}-list`" role="listbox" aria-label="Cities" class="mt-1 overflow-hidden rounded-xl border border-border">
      <li v-for="(item,index) in suggestions" :id="`${id}-${index}`" :key="item.placeId" role="option" :aria-selected="active === index" class="press-row cursor-pointer p-3 text-callout" :class="{ 'bg-blue-paper': active === index }" @mousedown.prevent @click="pick(item)"><span class="block font-semibold">{{ item.primaryText }}</span><span class="text-sm text-muted-foreground">{{ item.secondaryText }}</span></li>
    </ul>
    <button v-if="!manual && query !== (props.modelValue ? placeLabel(props.modelValue) : '')" type="button" class="min-h-9 text-sm font-semibold text-primary" @click="typeManually">Enter city manually</button>
    <div v-if="manual" class="grid grid-cols-2 gap-3" @keydown.enter.prevent="settle()">
      <label class="col-span-2 text-callout">City<input v-model="draft.town" :class="field" maxlength="120" /></label>
      <label v-if="needsRegion(draft.country)" class="text-callout">{{ draft.country === 'Canada' ? 'Province' : 'State' }}<select v-model="draft.province" :class="field"><option value="">Choose…</option><option v-for="region in regions" :key="region.code" :value="region.code">{{ region.name }}</option></select></label>
      <label v-else class="text-callout">Region<input v-model="draft.province" :class="field" maxlength="120" /></label>
      <label class="text-callout">Country<select v-model="draft.country" :class="field" @change="draft.province = ''"><option v-for="country in countries" :key="country">{{ country }}</option></select></label>
    </div>
    <p v-if="error" role="status" class="mt-1 text-sm text-muted-foreground">{{ error }}</p>
  </div>
</template>
