<script setup lang="ts">
// Keep aligned with DancerDefaults.vue in the other app (see AGENTS.md).
import { computed, nextTick, reactive, ref, useId } from 'vue'
import { Pencil } from '@lucide/vue'
import CityField from './CityField.vue'
import { placeLabel } from './places'
type Place = { town: string; province: string; country: string }
const props = defineProps<{ defaults: { studio?: string; location?: Place } }>()
const studio = defineModel<string>('studio', { required: true })
const location = defineModel<Place>('location', { required: true })
const root = ref<HTMLElement>()
const id = useId()
const unlocked = reactive({ studio: false, location: false })
const samePlace = (a?: Place, b?: Place) => ['town', 'province', 'country'].every(key => (a?.[key as keyof Place] || '') === (b?.[key as keyof Place] || ''))
const locked = computed(() => ({ studio: !unlocked.studio && !!props.defaults.studio && studio.value === props.defaults.studio,
  location: !unlocked.location && !!props.defaults.location?.town && samePlace(location.value, props.defaults.location) }))
async function unlock(key: 'studio' | 'location') {
  unlocked[key] = true
  await nextTick()
  const input = root.value?.querySelector<HTMLInputElement>(`[data-detail="${key}"] input`)
  input?.focus(); input?.select()
}
function restore(key: 'studio' | 'location') {
  if (key === 'studio') studio.value = props.defaults.studio!
  else location.value = { ...props.defaults.location! }
  unlocked[key] = false
}
</script>
<template>
  <div ref="root" class="grid grid-cols-2 items-start gap-4">
    <div data-detail="studio" class="min-w-0">
      <div class="flex items-baseline justify-between gap-2">
        <label :for="`${id}-studio`" class="text-callout font-medium">Teacher studio</label>
        <button v-if="defaults.studio && studio !== defaults.studio" type="button" class="shrink-0 text-xs text-primary" :title="defaults.studio" :aria-label="`Use account studio: ${defaults.studio}`" @click="restore('studio')">Use default</button>
      </div>
      <span class="relative mt-1.5 block"><input :id="`${id}-studio`" v-model="studio" :disabled="locked.studio" class="field h-12 w-full rounded-xl pl-3 pr-11 text-base disabled:opacity-70" maxlength="120" autocomplete="off" />
        <button v-if="locked.studio" type="button" class="press-row absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-primary" aria-label="Edit teacher studio" title="Using account default. Edit for this dancer." @click="unlock('studio')"><Pencil class="size-4" aria-hidden="true" /></button>
      </span>
    </div>
    <div data-detail="location" class="min-w-0">
      <template v-if="locked.location">
        <label class="block text-callout font-medium">City<span class="relative mt-1.5 block"><input :value="placeLabel(location)" disabled class="field h-12 w-full rounded-xl pl-3 pr-11 text-base disabled:opacity-70" />
          <button type="button" class="press-row absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-primary" aria-label="Edit city" title="Using account default. Edit for this dancer." @click="unlock('location')"><Pencil class="size-4" aria-hidden="true" /></button>
        </span></label>
      </template>
      <template v-else>
        <CityField v-model="location">
          <template #label-action="{ changed }"><button v-if="defaults.location?.town && (!samePlace(location, defaults.location) || changed)" type="button" class="shrink-0 text-xs text-primary" :title="placeLabel(defaults.location)" :aria-label="`Use account city: ${placeLabel(defaults.location)}`" @click="restore('location')">Use default</button></template>
        </CityField>
      </template>
    </div>
  </div>
</template>
