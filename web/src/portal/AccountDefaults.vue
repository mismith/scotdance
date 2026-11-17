<script setup lang="ts">
import AsyncButton from '@/components/AsyncButton.vue'
// Parity: also inspect mismith/scotdance-entries/src/views/AccountEditor.vue when changing behavior. See ./AGENTS.md.
import { onBeforeUnmount, ref, watch } from 'vue'
import { Shield, X } from '@lucide/vue'
import CityField from './CityField.vue'
import SaveIndicator from '@/account/SaveIndicator.vue'
import { useSaveFeedback } from '@/account/save-feedback'
import { tidyStudio } from './profileFields'
import { useConnectAccount, type Dancer } from './account'
const store = useConnectAccount()
const draft = ref<{ studio: string; location?: Dancer['location'] }>({ studio: '' })
const pending = new Set<'studio' | 'location'>()
const saving = ref(false)
const feedback = { studio: useSaveFeedback(), location: useSaveFeedback() }
const studioStatus = feedback.studio.status
const locationStatus = feedback.location.status
const studioDirty = ref(false)
const studioInput = ref<HTMLInputElement>()
function clearStudio() { draft.value.studio = ''; inputStudio(); studioInput.value?.focus() }
let studioTimer: ReturnType<typeof setTimeout> | undefined
function inputStudio() { if (studioStatus.value !== 'saving') feedback.studio.reset(); studioDirty.value = true; clearTimeout(studioTimer); studioTimer = setTimeout(settleStudio, 600) }
function settleStudio() { clearTimeout(studioTimer); if (!studioDirty.value) return; draft.value.studio = tidyStudio(draft.value.studio); studioDirty.value = false; save('studio') }
onBeforeUnmount(() => clearTimeout(studioTimer))
const error = ref('')
watch(() => store.defaults, value => { if (!saving.value && !pending.size && !studioDirty.value) draft.value = JSON.parse(JSON.stringify(value)) }, { immediate: true })
function save(field: 'category' | 'studio' | 'location') {
  if (field === 'category') return
  feedback[field].start()
  pending.add(field)
  void flush()
}
async function flush() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    while (pending.size) {
      const fields = [...pending]; pending.clear()
      const values = Object.fromEntries(fields.map(key => [key, JSON.parse(JSON.stringify(draft.value[key]))]))
      for (const key of fields) feedback[key].start()
      try {
        await store.saveDefaults(values)
        for (const key of fields) {
          if (!pending.has(key) && !(key === 'studio' && studioDirty.value)) feedback[key].done()
          else if (!pending.has(key)) feedback[key].reset()
        }
      }
      catch (e) { for (const key of fields) { pending.add(key); feedback[key].reset() } throw e }
    }
  } catch (e) { for (const key of pending) feedback[key].reset(); error.value = e instanceof Error ? e.message : 'Could not save your defaults.' }
  finally { saving.value = false }
}
</script>
<template>
  <section class="space-y-4 pt-3" aria-labelledby="private-details-title">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 id="private-details-title" class="text-title text-foreground">Private details</h2>
      <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Shield class="size-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />Shared only when you consent</span>
    </div>
    <div class="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
    <label class="text-callout font-medium">Teacher studio<span class="relative mt-1.5 block"><input ref="studioInput" v-model="draft.studio" class="field h-12 w-full rounded-xl pl-3 pr-24 text-base" placeholder="e.g. Glenmore School of Dance" maxlength="120" @input="inputStudio" @blur="settleStudio" @keydown.enter.prevent="settleStudio" /><SaveIndicator :status="studioStatus" :style="{ right: draft.studio ? '3.25rem' : undefined }" /><button v-if="draft.studio" type="button" class="absolute right-0 top-1/2 -translate-y-1/2 flex size-12 items-center justify-center text-muted-foreground" aria-label="Clear teacher studio" @pointerdown.prevent @click="clearStudio"><X class="size-4" aria-hidden="true" /></button></span></label>
    <CityField v-model="draft.location" :save-status="locationStatus" @changed="save('location')" />
    <p v-if="error" role="alert" class="text-sm text-destructive sm:col-span-2">{{ error }} <AsyncButton type="button" class="text-primary underline" @click="flush">Try again</AsyncButton></p>
    </div>
  </section>
</template>
