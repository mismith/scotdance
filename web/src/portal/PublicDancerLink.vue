<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Link, ExternalLink } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { findPublicDancers, type PublicDancer } from './publicDancers'
const props = defineProps<{ firstName: string; lastName: string }>()
const model = defineModel<PublicDancer | null>()
const query = ref('')
const manual = ref(false)
const dismissed = ref(false)
const matches = ref<PublicDancer[]>([])
const searching = ref(false)
const error = ref('')
const name = computed(() => manual.value ? query.value : [props.firstName.trim(), props.lastName.trim()].filter(Boolean).join(' '))
let controller: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined
function cancel() { controller?.abort(); clearTimeout(timer) }
watch([name, model, manual, dismissed], () => {
  cancel()
  matches.value = []
  error.value = ''
  searching.value = false
  if (model.value || dismissed.value || name.value.trim().length < 3 || (!manual.value && (!props.firstName.trim() || !props.lastName.trim()))) return
  const current = new AbortController()
  controller = current
  searching.value = true
  timer = setTimeout(async () => {
    try { const result = await findPublicDancers(name.value, current.signal); if (!current.signal.aborted) matches.value = result }
    catch { if (!current.signal.aborted) error.value = 'Couldn’t search right now. You can save without linking.' }
    finally { if (!current.signal.aborted) searching.value = false }
  }, 400)
}, { immediate: true })
function unlink() { dismissed.value = true; model.value = null }
function search() { dismissed.value = false; query.value = [props.firstName, props.lastName].join(' ').trim(); manual.value = true }
onBeforeUnmount(cancel)
</script>
<template>
  <section class="space-y-3 border-t border-border pt-5">
    <h2 class="flex items-center gap-2 text-heading"><Link class="size-5 text-primary" aria-hidden="true" />ScotDance.app profile <span class="text-callout font-normal text-muted-foreground">(optional)</span></h2>
    <p class="text-callout text-muted-foreground">Link their public results profile for your own reference. This doesn’t verify identity, change results or make your saved details public.</p>
    <div v-if="model" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-paper p-3">
      <a :href="`https://next.scotdance.app/dancers/${encodeURIComponent(model.id)}`" target="_blank" rel="noopener" class="inline-flex items-center gap-2 font-semibold text-primary">{{ model.name }}<ExternalLink class="size-4" aria-hidden="true" /></a>
      <Button variant="plain" @click="unlink">Unlink</Button>
    </div>
    <template v-else>
      <label v-if="manual" class="block text-callout">Search public dancers<input v-model="query" class="field mt-1.5 h-12 w-full rounded-xl px-3 text-base" maxlength="240" /></label>
      <p v-if="searching || error" role="status" class="text-callout text-muted-foreground">{{ error || 'Looking for matching public profiles…' }}</p>
      <ul v-if="matches.length" class="space-y-2">
        <li v-for="match in matches" :key="match.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-paper p-3">
          <a :href="`https://next.scotdance.app/dancers/${encodeURIComponent(match.id)}`" target="_blank" rel="noopener" class="inline-flex items-center gap-2 font-semibold text-primary">{{ match.name }}<ExternalLink class="size-4" aria-hidden="true" /></a>
          <Button :aria-label="`Link ${match.name}`" @click="model = match">Link profile</Button>
        </li>
      </ul>
      <p v-else-if="manual && !searching && !error && query.trim().length >= 3" class="text-callout text-muted-foreground">No matching public profiles found.</p>
      <Button v-if="!manual" variant="plain" @click="search">Search by another name</Button>
    </template>
  </section>
</template>
