<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, ChevronRight, Shield, UserRound } from '@lucide/vue'
import ConnectBrand from '../ConnectBrand.vue'
import DancerEditor from '../DancerEditor.vue'
import Button from '@/components/ui/Button.vue'
import type { Dancer } from '../account'
import type { EditorWrite, EditorResult } from '../editor/types'
type Saved = { dancer: Dancer; photo: string | null }
const key = 'connect.photo-preview.v1.account'
const initial = (): Saved[] => [
  {
    dancer: {
      id: 'photo-preview-dancer-001',
      revision: 1,
      firstName: 'Jamie',
      lastName: 'Fraser',
      birthday: '2014-04-12',
      category: 'Novice',
      studio: 'Glenmore School of Dance',
      registrationNumber: '',
      publicDancer: null,
      location: { town: 'Calgary', province: 'AB', country: 'Canada' },
    },
    photo: null,
  },
]
function read(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || initial()
  } catch {
    return initial()
  }
}
const storagePreview = import.meta.env.DEV && new URLSearchParams(location.search).has('storage')
const rows = ref(storagePreview ? [] : read())
const ready = ref(!storagePreview)
async function localApi(action: string, body = {}) {
  const response = await fetch(`http://127.0.0.1:5351/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Local photo API unavailable.')
  return data
}
async function reloadStorage() {
  const state = await localApi('load')
  rows.value = await Promise.all(state.dancers.map(async (dancer: Dancer) => ({ dancer, photo: dancer.photoVersion ? (await localApi('photo', { id: dancer.id })).photo : null })))
}
onMounted(async () => { if (storagePreview) { try { await reloadStorage() } catch (e) { issue.value = String(e) } finally { ready.value = true } } })
const selected = ref<Saved>()
const open = ref(false)
const embedded = ref(false)
const issue = ref('')
const defaults = {
  studio: 'Glenmore School of Dance',
  location: { town: 'Calgary', province: 'AB', country: 'Canada' },
}
async function edit(value?: Saved) {
  selected.value = value
  issue.value = ''
  if (!embedded.value) {
    open.value = true
    return
  }
  try {
    const { openDancerEditor } = await import(
      /* @vite-ignore */ `${location.origin}/dancer-editor.js`
    )
    await openDancerEditor({
      load: async () => ({
        dancer: value ? JSON.parse(JSON.stringify(value.dancer)) : undefined,
        defaults,
        defaultsRevision: 0,
        otherDancers: false,
        photo: { value: value?.photo ?? null },
      }),
      save: persist,
    })
  } catch (error) {
    issue.value = error instanceof Error ? error.message : 'Could not open editor.'
  }
}
async function persist(write: EditorWrite): Promise<EditorResult> {
  if (storagePreview) {
    const { id, revision, firstName, lastName, birthday, category, studio, registrationNumber, location, publicDancer } = write.dancer
    const dancer = { firstName, lastName, birthday, category, studio, registrationNumber, ...(location ? { location } : {}), ...(publicDancer !== undefined ? { publicDancer } : {}) }
    await localApi(write.action, { id, revision, dancer, requestId: write.requestId, ...(write.photo !== undefined ? { photo: write.photo } : {}) })
    await reloadStorage()
    return write.action === 'delete' ? { id, deleted: true } : { id, dancer: JSON.parse(JSON.stringify(rows.value.find(r => r.dancer.id === id)!.dancer)) }
  }
  const next = rows.value.filter((r) => r.dancer.id !== write.dancer.id)
  const dancer = { ...write.dancer, revision: write.dancer.revision + 1 }
  if (write.action === 'save') next.push({ dancer, photo: write.photo !== undefined ? write.photo : rows.value.find(r => r.dancer.id === dancer.id)?.photo ?? null })
  // Fictional local preview only. These bytes never leave this browser.
  localStorage.setItem(key, JSON.stringify(next))
  rows.value = next
  return write.action === 'delete'
    ? { id: dancer.id, deleted: true }
    : { id: dancer.id, dancer }
}
function clear() {
  localStorage.removeItem(key)
  rows.value = initial()
}
</script>
<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:px-8">
    <header class="mb-8"><ConnectBrand /></header>
    <aside
      class="text-muted-foreground mb-6 flex flex-wrap items-center gap-2 text-xs"
      aria-label="Preview controls"
    >
      <span>{{ storagePreview ? "Local preview · fictional account · private storage emulator" : "Local preview · photos stay in this browser" }}</span>
      <Button v-if="!storagePreview" size="sm" variant="plain" :disabled="open" @click="clear"
        >Reset preview</Button
      >
    </aside>
    <label class="text-muted-foreground mb-3 flex items-center gap-2 text-xs"
      ><input v-model="embedded" type="checkbox" :disabled="open" />Embedded form</label
    >
    <p v-if="issue" role="alert" class="text-destructive">{{ issue }}</p>
    <h1 class="text-title mb-5">Dancers</h1>
    <div class="mb-4 flex flex-wrap items-center gap-4">
      <Button variant="primary" :disabled="!ready" @click="edit()"
        ><Plus aria-hidden="true" />Add dancer</Button
      >
      <span class="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
        ><Shield class="size-4 text-amber-500" aria-hidden="true" />Shared only when you
        consent</span
      >
    </div>
    <div v-if="!ready" class="h-24 rounded-xl bg-foreground/10 animate-pulse" aria-label="Loading dancers" />
    <ul v-else class="-mx-3">
      <li v-for="record in rows" :key="record.dancer.id">
        <button
          type="button"
          class="press-row focus-inset flex min-h-24 w-full items-center gap-4 rounded-xl px-3 py-3 text-left [--tint-hover:color-mix(in_oklab,var(--foreground)_3%,transparent)]"
          @click="edit(record)"
        >
          <span
            class="field text-muted-foreground flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            ><img
              v-if="record.photo"
              :src="record.photo"
              alt=""
              class="h-full w-full object-cover" /><UserRound
              v-else
              class="size-6"
              aria-hidden="true"
          /></span>
          <span class="min-w-0 flex-1"
            ><span class="block text-base font-semibold"
              >{{ record.dancer.firstName }} {{ record.dancer.lastName }}</span
            ><span class="text-muted-foreground text-sm"
              >{{ record.dancer.category }} · {{ record.dancer.studio }}</span
            ></span
          >
          <ChevronRight
            class="text-muted-foreground size-5 shrink-0"
            aria-hidden="true"
          />
        </button>
      </li>
    </ul>
    <DancerEditor
      v-if="open"
      :dancer="selected?.dancer"
      :defaults="{
        studio: 'Glenmore School of Dance',
        location: { town: 'Calgary', province: 'AB', country: 'Canada' },
      }"
      :defaults-revision="0"
      :other-dancers="false"
      :photo="{ value: selected?.photo ?? null }"
      :persist="persist"
      @close="open = false"
    />
  </div>
</template>
