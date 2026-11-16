<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Link, ExternalLink, X, LoaderCircle } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { normalizeName } from '../../../shared/normalize'
import { findPublicDancers, type PublicDancer } from './publicDancers'
const props = defineProps<{ firstName: string; lastName: string }>()
// undefined = not matched yet; null = deliberately unlinked (persisted on Save dancer).
const model = defineModel<PublicDancer | null>()
const query = ref('')
const manual = ref(false)
const matches = ref<PublicDancer[]>([])
const searching = ref(false)
const error = ref('')
const fullName = computed(() => [props.firstName.trim(), props.lastName.trim()].filter(Boolean).join(' '))
const name = computed(() => manual.value ? query.value : fullName.value)
let autoName = ''
let controller: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let pendingSearch: (() => Promise<void>) | undefined
let searchPromise: Promise<void> | undefined
function cancel() { controller?.abort(); clearTimeout(timer); pendingSearch = undefined; searchPromise = undefined }
function startSearch() { clearTimeout(timer); const run = pendingSearch; pendingSearch = undefined; if (run) searchPromise = run(); return searchPromise }
watch(fullName, value => {
  if (autoName && normalizeName(value) !== autoName) { autoName = ''; model.value = undefined }
})
watch([name, model, manual], () => {
  cancel(); matches.value = []; error.value = ''; searching.value = false
  if ((!manual.value && model.value !== undefined) || name.value.trim().length < 3 || (!manual.value && (!props.firstName.trim() || !props.lastName.trim()))) return
  const current = new AbortController()
  controller = current
  searching.value = true
  pendingSearch = async () => {
    try {
      const result = await findPublicDancers(name.value, current.signal)
      if (current.signal.aborted) return
      const exact = result.filter(match => normalizeName(match.name) === normalizeName(fullName.value))
      if (!manual.value && exact.length === 1) {
        autoName = normalizeName(fullName.value)
        model.value = exact[0]
      } else matches.value = result
    } catch { if (!current.signal.aborted) error.value = 'Search unavailable. Try again later.' }
    finally { if (!current.signal.aborted) searching.value = false }
  }
  timer = setTimeout(startSearch, 400)
}, { immediate: true })
function unlink() { autoName = ''; manual.value = false; model.value = null }
function search() { query.value = fullName.value; manual.value = true }
function choose(match: PublicDancer) { autoName = ''; model.value = match; manual.value = false }
async function finishMatching() {
  if (model.value !== undefined || manual.value) return
  const pending = startSearch(), current = controller
  if (!pending) return
  let deadline: ReturnType<typeof setTimeout> | undefined
  try { await Promise.race([pending, new Promise<void>(resolve => { deadline = setTimeout(() => { current?.abort(); resolve() }, 5000) })]) }
  finally { clearTimeout(deadline) }
}
defineExpose({ finishMatching })
onBeforeUnmount(cancel)
</script>
<template>
  <div class="min-w-0">
    <div class="flex min-h-11 flex-wrap items-center gap-x-2 text-callout">
      <LoaderCircle v-if="searching && !manual" class="size-4 shrink-0 animate-spin text-primary" aria-label="Finding public profile" />
      <Link v-else class="size-4 shrink-0 text-primary" aria-hidden="true" />
      <a v-if="model" :href="`https://next.scotdance.app/dancers/${encodeURIComponent(model.id)}`" target="_blank" rel="noopener" class="inline-flex min-w-0 flex-1 items-center gap-1 text-primary" :title="model.name"><span class="truncate">{{ model.name }}</span><ExternalLink class="size-3 shrink-0" aria-hidden="true" /></a>
      <span v-else class="min-w-0 flex-1 text-muted-foreground">{{ searching && !manual ? 'Finding public profile…' : 'ScotDance.app profile' }}</span>
      <Button variant="plain" size="sm" @click="search">{{ model ? 'Change' : 'Search' }}</Button>
      <Button v-if="model" variant="plain" size="sm" @click="unlink">Unlink</Button>
    </div>
    <div v-if="manual" class="mt-2 space-y-2">
      <div class="flex items-center gap-2">
        <label class="min-w-0 flex-1"><span class="sr-only">Search public dancers</span><input v-model="query" class="field h-12 w-full rounded-xl px-3 text-base" maxlength="240" /></label>
        <button type="button" class="press-row flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground" aria-label="Close profile search" @click="manual = false"><X class="size-5" aria-hidden="true" /></button>
      </div>
      <p v-if="searching || error" role="status" class="text-sm text-muted-foreground">{{ error || 'Searching…' }}</p>
      <ul v-else-if="matches.length" class="space-y-1">
        <li v-for="match in matches" :key="match.id" class="flex items-center justify-between gap-2 py-1">
          <a :href="`https://next.scotdance.app/dancers/${encodeURIComponent(match.id)}`" target="_blank" rel="noopener" class="min-w-0 truncate text-callout text-primary">{{ match.name }}</a>
          <Button size="sm" :aria-label="`Link ${match.name}`" @click="choose(match)">Link</Button>
        </li>
      </ul>
      <p v-else-if="query.trim().length >= 3" class="text-sm text-muted-foreground">No matching public profiles found.</p>
    </div>
  </div>
</template>
