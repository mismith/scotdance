<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import CityField from './CityField.vue'
import { tidy } from './profileFields'
import { useConnectAccount, type Dancer } from './account'
const store = useConnectAccount()
const draft = ref<{ studio: string; location?: Dancer['location'] }>({ studio: '' })
const pending = new Set<'studio' | 'location'>()
const saving = ref(false)
const studioDirty = ref(false)
let studioTimer: ReturnType<typeof setTimeout> | undefined
function inputStudio() { studioDirty.value = true; clearTimeout(studioTimer); studioTimer = setTimeout(settleStudio, 600) }
function settleStudio() { clearTimeout(studioTimer); if (!studioDirty.value) return; draft.value.studio = tidy(draft.value.studio); studioDirty.value = false; save('studio') }
onBeforeUnmount(() => clearTimeout(studioTimer))
const error = ref('')
watch(() => store.defaults, value => { if (!saving.value && !pending.size && !studioDirty.value) draft.value = JSON.parse(JSON.stringify(value)) }, { immediate: true })
function save(field: 'category' | 'studio' | 'location') {
  if (field === 'category') return
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
      try { await store.saveDefaults(values) }
      catch (e) { for (const key of fields) pending.add(key); throw e }
    }
  } catch (e) { error.value = e instanceof Error ? e.message : 'Could not save your defaults.' }
  finally { saving.value = false }
}
</script>
<template>
  <section class="relative grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
    <label class="text-callout font-medium">Teacher studio<input v-model="draft.studio" class="field mt-1.5 h-12 w-full rounded-xl px-3 text-base" placeholder="e.g. Glenmore School of Dance" maxlength="120" @input="inputStudio" @blur="settleStudio" @keydown.enter.prevent="settleStudio" /></label>
    <CityField v-model="draft.location" @changed="save('location')" />
    <span role="status" class="pointer-events-none absolute right-0 top-full mt-1 text-xs text-muted-foreground">{{ saving ? 'Saving…' : '' }}</span>
    <p v-if="error" role="alert" class="text-sm text-destructive sm:col-span-2">{{ error }} <button type="button" class="text-primary underline" @click="flush">Try again</button></p>
  </section>
</template>
