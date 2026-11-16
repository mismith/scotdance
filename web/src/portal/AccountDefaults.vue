<script setup lang="ts">
import { ref, watch } from 'vue'
import DancerDetails from './DancerDetails.vue'
import { useConnectAccount, type Dancer } from './account'
const store = useConnectAccount()
const draft = ref<{ studio: string; location?: Dancer['location'] }>({ studio: '' })
const pending = new Set<'studio' | 'location'>()
const saving = ref(false)
const error = ref('')
watch(() => store.defaults, value => { if (!saving.value && !pending.size) draft.value = JSON.parse(JSON.stringify(value)) }, { immediate: true })
async function save(field: 'category' | 'studio' | 'location') {
  if (field === 'category') return
  pending.add(field)
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
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-3"><h2 class="text-heading">Studio &amp; location</h2><span class="min-h-5 text-sm text-muted-foreground" role="status">{{ saving ? 'Saving…' : '' }}</span></div>
    <p class="text-callout text-muted-foreground">Starting details for new dancers. Each dancer keeps their own saved copy.</p>
    <DancerDetails v-model="draft" :fields="['studio', 'location']" @changed="save" />
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }} <button type="button" class="text-primary underline" @click="save('studio')">Try again</button></p>
  </section>
</template>
