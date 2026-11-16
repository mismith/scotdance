<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Pencil, Search, ExternalLink, X, LoaderCircle } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { normalizeName } from '../../../shared/normalize'
import { findPublicDancers, type PublicDancer } from './publicDancers'
const props = defineProps<{ firstName: string; lastName: string }>()
// undefined = not matched yet; null = deliberately unlinked (persisted on Save dancer).
const model = defineModel<PublicDancer | null>()
const query = ref('')
const searchInput = ref<HTMLInputElement>()
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
function clearProfile() { autoName = ''; model.value = null; query.value = ''; searchInput.value?.focus() }
function editQuery() { if (!query.value.trim()) { autoName = ''; model.value = null } }
async function search() { query.value = model.value?.name || fullName.value; manual.value = true; await nextTick(); searchInput.value?.focus(); searchInput.value?.select() }
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
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span class="text-callout font-medium">ScotDance.app dancer profile</span>
    </div>
    <div v-if="!manual" class="field mt-1.5 flex h-12 min-w-0 items-center gap-2 rounded-xl px-3 text-base">
      <template v-if="model">
        <a :href="`https://next.scotdance.app/dancers/${encodeURIComponent(model.id)}`" target="_blank" rel="noopener" class="inline-flex min-w-0 items-center gap-1 text-primary" :title="model.name"><span class="truncate">{{ model.name }}</span><ExternalLink class="size-3 shrink-0" aria-hidden="true" /></a>
        <button type="button" class="press-row -mr-2.5 ml-auto flex size-11 shrink-0 items-center justify-center rounded-full text-primary" aria-label="Edit dancer profile" @click="search"><Pencil class="size-4" aria-hidden="true" /></button>
      </template>
      <button v-else type="button" class="inline-flex h-full w-full min-w-0 items-center gap-2 text-left text-primary" @click="search">
        <LoaderCircle v-if="searching && !manual" class="size-4 shrink-0 animate-spin" aria-hidden="true" />
        <Search v-else class="size-4 shrink-0" aria-hidden="true" />
        {{ searching && !manual ? 'Finding a profile…' : 'Find a dancer profile' }}
      </button>
    </div>
    <div v-if="manual" class="mt-1.5 space-y-2">
      <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" aria-hidden="true" />
        <label class="block min-w-0"><span class="sr-only">Search public dancers</span><input ref="searchInput" v-model="query" placeholder="Find a dancer profile" class="field h-12 w-full rounded-xl pl-10 pr-12 text-base" maxlength="240" @input="editQuery" @keydown.esc.stop.prevent="manual = false" /></label>
        <button type="button" class="press-row absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground" aria-label="Clear dancer profile" @click="clearProfile"><X class="size-5" aria-hidden="true" /></button>
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
