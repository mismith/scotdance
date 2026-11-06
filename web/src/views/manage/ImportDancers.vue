<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { until, useEventListener, useIntervalFn, useNow } from '@vueuse/core'
import { onValue } from 'firebase/database'
import { CaseSensitive, ChevronDown, ClipboardPaste, Download, FileSpreadsheet, Inbox, RotateCcw } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import NumberTile from '@/components/admin/NumberTile.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { toast } from '@/lib/admin/feedback'
import { goUp } from '@/lib/back'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { inboxFor, sentAgo, type InboxItem } from '@/lib/admin/inbox'
import { dataRef } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import {
  decodeText,
  gridFromSheet,
  gridFromText,
  hasCapitals,
  hasWholeNames,
  parseGrid,
  pickSheet,
  planImport,
  planUpdates,
  spellCapitals,
  splitFullName,
  splitWholeNames,
  type ImportedTeam,
  type Grid,
  type PlannedDancer,
  type TableField,
} from '@/lib/admin/importDancers'
import { entryLine, entryName } from '@/lib/entries'

// Import dancers: bring the list, check it reads right, import. Each entry
// shows as it will in the Dancers list, under its age group. The column
// headings say what each column of the file became; change one if it's wrong.
// Rows with the same number in an age group, or names joined by "&", are
// one entry with several dancers (lib/admin/importDancers).

const m = useManagedCompetition()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// --- Step 1: where the list comes from
const sheets = ref<Array<{ sheet: string; grid: Grid }>>([])
const sheetIndex = ref(0)
const sourceName = ref('')
const reading = ref(false)
const readError = ref<string | null>(null)
const pasted = ref('')
const pasting = ref(false)
const pasteBox = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (file) await readFile(file)
}
async function readFile(file: File) {
  reading.value = true
  readError.value = null
  try {
    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
      sheets.value = [{ sheet: file.name, grid: gridFromText(decodeText(await file.arrayBuffer())) }]
    } else {
      const { default: readXlsx } = await import('read-excel-file/browser')
      const all = await readXlsx(file)
      sheets.value = all.map((s) => ({ sheet: s.sheet, grid: gridFromSheet(s.data as unknown[][]) }))
    }
    sheetIndex.value = pickSheet(sheets.value)
    sourceName.value = file.name
  } catch {
    readError.value = 'That file couldn’t be read. From Excel or Google Sheets, save it as .xlsx or CSV and try again.'
  } finally {
    reading.value = false
  }
}
function usePasted(text = pasted.value) {
  if (!text.trim()) return
  sheets.value = [{ sheet: 'Pasted', grid: gridFromText(text) }]
  sheetIndex.value = 0
  sourceName.value = 'Pasted cells'
}
// Paste: straight from the clipboard where the browser allows it, else a box to paste into.
async function paste() {
  try {
    const text = await navigator.clipboard.readText()
    if (text.trim()) return usePasted(text)
  } catch {
    // Not allowed here: paste by hand below.
  }
  pasting.value = true
  await nextTick()
  pasteBox.value?.focus()
}
// ⌘V anywhere on the page does the same.
useEventListener(document, 'paste', (e: ClipboardEvent) => {
  if (sheets.value.length || (e.target instanceof Element && e.target.closest('input, textarea'))) return
  const text = e.clipboardData?.getData('text') ?? ''
  if (text.trim()) {
    e.preventDefault()
    usePasted(text)
  }
})

// What the organiser's other tools sent them (Splits first), read like pasted cells.
const inboxTree = ref<unknown>(null)
const inboxLoaded = ref(false)
watch(
  () => auth.uid,
  (uid, _, onCleanup) => {
    inboxTree.value = null
    inboxLoaded.value = false
    if (!uid) return
    const done = (val: unknown) => ((inboxTree.value = val), (inboxLoaded.value = true))
    onCleanup(onValue(dataRef(`users:inbox/${uid}`), (snap) => done(snap.val()), () => done(null)))
  },
  { immediate: true },
)
const inbox = computed(() => inboxFor(inboxTree.value, m.competitionId.value))
const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 30_000) })
/** The inbox item in the preview, removed once it's imported. */
const fromItem = ref<string | null>(null)
function openItem(item: InboxItem) {
  sheets.value = [{ sheet: item.name, grid: gridFromText(item.text) }]
  sheetIndex.value = 0
  sourceName.value = item.name
  fromItem.value = item.id
}
const itemPath = (id: string) => `users:inbox/${auth.uid}/${id}`
async function dismissItem({ id, ...item }: InboxItem) {
  try {
    await write({ [itemPath(id)]: null })
    toast(`Dismissed ${item.name}`, { action: { label: 'Undo', run: () => write({ [itemPath(id)]: item }) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
// Arriving from a tool's link (?inbox=<itemId>): straight to its preview.
const linked = route.query.inbox
if (typeof linked === 'string' && linked) {
  void until(inboxLoaded).toBe(true).then(() => {
    const item = inboxFor(inboxTree.value).find((i) => i.id === linked)
    if (item) openItem(item)
    else toast('That list isn’t in your inbox. It may have been imported already, or sent to another account.')
  })
}

// A file held over the drop zone lifts it.
const over = ref(false)
function onDrop(e: DragEvent) {
  over.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void readFile(file)
}
function startOver() {
  sheets.value = []
  fromItem.value = null
  pasted.value = ''
  pasting.value = false
  readError.value = null
  removeMissing.value = false
  chosen.value = null
}

// --- Step 2: reading it
const grid = computed(() => sheets.value[sheetIndex.value]?.grid ?? [])
/** The organiser's choice of what each column holds, when it isn't what was guessed. */
const chosen = ref<Record<TableField, number> | null>(null)
// Columns chosen for one sheet don't fit another.
watch(sheetIndex, () => (chosen.value = null))
const read = computed(() => parseGrid(grid.value, chosen.value))
// Text in capitals is always written as it's spelled, with one shown so
// it's clear what changes (and a word to type it that way next time).
const capitals = computed(() => !!read.value && hasCapitals(read.value.dancers))
const spelledList = computed(() =>
  read.value
    ? spellCapitals(read.value.dancers, {
        names: m.dancers.value.flatMap((d) => [d.firstName ?? '', d.lastName ?? '']),
        locations: m.dancers.value.map((d) => d.location ?? ''),
        groups: [...m.categories.value.map((c) => c.name ?? ''), ...m.groups.value.map((g) => g.name ?? '')],
      })
    : [],
)
const capitalsExample = computed(() => {
  const i = read.value?.dancers.findIndex((d) => d.firstName.trim() && d.lastName.trim() && hasCapitals([d])) ?? -1
  const name = (d?: { firstName: string; lastName: string }) => `${d?.firstName ?? ''} ${d?.lastName ?? ''}`.trim()
  return i < 0 ? null : { typed: name(read.value?.dancers[i]), spelled: name(spelledList.value[i]) }
})
// Whole names in First name are split unless unticked (a sheet of
// choreography titles, say), with one shown so it's clear what changes.
const wholeNames = computed(() => !!read.value && hasWholeNames(read.value.dancers))
const splitNames = ref(true)
const wholeNameExample = computed(() => {
  const name = spelledList.value.find((d) => /[ ,]/.test(d.firstName.trim()))?.firstName.trim() ?? ''
  return { name, ...splitFullName(name) }
})
const parsed = computed(() =>
  read.value ? { ...read.value, dancers: wholeNames.value && splitNames.value ? splitWholeNames(spelledList.value) : spelledList.value } : read.value,
)
// "The guide": what a list should look like, when this one couldn't be read.
const unreadable = computed(() => !!readError.value || (sheets.value.length > 0 && !parsed.value?.dancers.length))

const FIELDS: Array<[TableField, string]> = [
  ['number', 'Number'],
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['fullName', 'Full name'],
  ['members', 'Dancers'],
  ['location', 'Location'],
  ['group', 'Age group'],
  ['category', 'Category'],
  ['title', 'Routine'],
  ['studio', 'Studio'],
]
/** The file's columns that hold anything, each with what it became. */
const fileColumns = computed(() => {
  const p = parsed.value
  if (!p?.columns) return []
  const table = p.layout === 'table'
  const width = Math.max(0, ...grid.value.map((r) => r.length))
  const letter = (i: number) => String.fromCharCode(65 + (i % 26))
  return Array.from({ length: width }, (_, i) => i)
    .filter((i) => grid.value.some((r) => r[i]))
    .map((i) => ({
      index: i,
      name: table ? p.headers?.[i] || `Column ${letter(i)}` : `Column ${letter(i)}`,
      field: (Object.keys(p.columns!) as TableField[]).find((f) => p.columns![f] === i) ?? '',
      options: FIELDS.filter(([f]) => table || (f !== 'group' && f !== 'category')),
    }))
})
/** The first entries' rows, under the columns' headings. */
const sampleRows = computed(() => {
  const n = parsed.value?.columns?.number ?? -1
  return grid.value.filter((r) => /^\d/.test((n >= 0 ? r[n] : r.find(Boolean)) ?? '')).slice(0, 2)
})
function setColumn(index: number, field: TableField | '') {
  const next = { ...parsed.value!.columns! }
  for (const f of Object.keys(next) as TableField[]) if (next[f] === index) next[f] = -1
  if (field) next[field] = index
  chosen.value = next
}
// What a table still needs a column for.
const missingColumns = computed(() => {
  const c = parsed.value?.columns
  if (!c || parsed.value?.layout !== 'table') return []
  return [c.number < 0 && 'numbers', c.firstName < 0 && c.lastName < 0 && c.fullName < 0 && c.members < 0 && 'names', c.group < 0 && c.category < 0 && 'age groups'].filter(
    (x): x is string => !!x,
  )
})

const existing = computed(() => ({
  categories: m.categories.value.map((c) => ({ id: c.id, name: c.name })),
  groups: m.groups.value.map((g) => ({ id: g.id, name: g.name, categoryId: g.categoryId })),
  dancers: m.dancers.value.map((d) => ({
    id: d.id,
    num: d.num,
    firstName: d.firstName,
    lastName: d.lastName,
    location: d.location,
    groupId: d.groupId,
    label: d.label,
    team: d.team,
    title: d.title,
    studio: d.studio,
    members: d.members,
  })),
}))
const plan = computed(() => (parsed.value ? planImport(parsed.value.dancers, existing.value) : null))

// Each entry as the Dancers list will show it, under its age group.
const teamEntry = (t: ImportedTeam) => ({
  team: true,
  title: t.title,
  studio: t.studio,
  location: t.location,
  members: Object.fromEntries(t.members.map((x, i) => [String(i), { ...x, _order: i }])),
})
const nameOf = (d: PlannedDancer) => (d.team ? entryName(teamEntry(d.team)) : `${d.source.firstName} ${d.source.lastName}`.trim()) || '–'
const lineOf = (d: PlannedDancer) => (d.team ? entryLine(teamEntry(d.team)) : entryLine({ title: d.source.title, studio: d.source.studio, location: d.source.location }))
const groupName = (d: PlannedDancer) => `${d.source.category} ${d.source.group}`.trim()
const byGroup = computed(() => {
  const out = new Map<string, PlannedDancer[]>()
  for (const d of plan.value?.dancers ?? []) out.set(groupName(d), [...(out.get(groupName(d)) ?? []), d])
  return [...out.entries()]
})
const going = computed(() => (plan.value?.dancers ?? []).filter((d) => d.status === 'new' || d.status === 'changed'))
const summary = computed(() => {
  const p = plan.value
  if (!p) return ''
  const entries = p.dancers.filter((d) => d.status !== 'error').length
  const groups = new Set(p.dancers.filter((d) => d.status !== 'error').map(groupName)).size
  const solo = p.dancers.every((d) => !d.team)
  return `${entries} ${solo ? (entries === 1 ? 'dancer' : 'dancers') : entries === 1 ? 'entry' : 'entries'} in ${groups} ${groups === 1 ? 'age group' : 'age groups'}`
})
const errors = computed(() => (plan.value?.dancers ?? []).filter((d) => d.status === 'error').length)

const removeMissing = ref(false)
const writes = computed(() => going.value.length + (removeMissing.value ? (plan.value?.missing.length ?? 0) : 0))
const importLabel = computed(() => {
  const p = plan.value
  if (!p || !writes.value) return 'Nothing to change'
  const n = going.value.length
  const plural = (k: number) => (k === 1 ? 'dancer' : 'dancers')
  if (!n) return `Remove ${p.missing.length} ${plural(p.missing.length)}`
  return `Import ${n} ${going.value.some((d) => d.team) ? (n === 1 ? 'entry' : 'entries') : plural(n)}`
})
// Removing a dancer leaves an unknown dancer (?) wherever they have results.
const missingWithResults = computed(() => {
  const placed = new Set<string>()
  for (const byDance of Object.values(m.results.value)) {
    for (const list of Object.values(byDance ?? {})) if (Array.isArray(list)) for (const p of list) placed.add(String(p).replace(/:tie$/, ''))
  }
  for (const byDance of Object.values(m.points.value)) {
    for (const byJudge of Object.values(byDance ?? {})) for (const ids of Object.values(byJudge ?? {})) if (Array.isArray(ids)) for (const id of ids) placed.add(id)
  }
  return (plan.value?.missing ?? []).filter((d) => placed.has(d.id)).length
})

// --- Step 3: saving it, all at once
const importing = ref(false)
async function doImport() {
  const p = plan.value
  if (!p) return
  importing.value = true
  const nextOrder = (items: Array<{ _order?: number }>) => items.reduce((max, i) => Math.max(max, typeof i._order === 'number' ? i._order : -1), -1) + 1
  const updates = planUpdates(p, existing.value, m.newKey, {
    removeMissing: removeMissing.value,
    nextGroupOrder: nextOrder(m.groups.value),
    nextCategoryOrder: nextOrder(m.categories.value),
  })
  const parts = [
    p.counts.new && `${p.counts.new} added`,
    p.counts.changed && `${p.counts.changed} updated`,
    removeMissing.value && p.missing.length && `${p.missing.length} removed`,
  ].filter(Boolean)
  const message = `Imported: ${parts.join(', ') || 'nothing to change'}`
  try {
    const change = await m.writeData(updates, message)
    toast(message, { action: { label: 'Undo', run: () => m.undoChange(change) } })
    // Imported: it's done with in the inbox.
    if (fromItem.value) void write({ [itemPath(fromItem.value)]: null }).catch(() => {})
    // Back to the list: a step back if that's where they came from, so it isn't in history twice.
    goUp(router, { name: 'manage.dancers', params: { competitionId: m.competitionId.value } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl space-y-6 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader title="Import dancers" />

    <!-- Step 1 -->
    <template v-if="!sheets.length">
      <section
        v-for="item in inbox"
        :key="item.id"
        class="surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl py-3 pr-3 pl-4"
      >
        <Inbox class="text-primary size-6 shrink-0" />
        <div class="min-w-48 flex-1">
          <h2 class="text-heading">From {{ item.source }}</h2>
          <p class="text-muted-foreground text-sm break-words">{{ item.name }}, sent {{ sentAgo(item.sentAt, now.getTime()) }}</p>
        </div>
        <div class="ml-auto flex gap-2">
          <Button variant="plain" :disabled="!canEdit" @click="dismissItem(item)">Dismiss</Button>
          <Button variant="primary" @click="openItem(item)">Use it</Button>
        </div>
      </section>

      <section
        :class="[
          'space-y-4 rounded-2xl border-2 border-dashed p-6 text-center transition-[scale,background-color,border-color] duration-(--dur-base) ease-snappy motion-reduce:transition-colors',
          over ? 'border-primary bg-blue-paper scale-[1.01] motion-reduce:scale-100' : 'border-strong/60 bg-card',
        ]"
        @dragenter.prevent="over = true"
        @dragover.prevent="over = true"
        @dragleave.self="over = false"
        @drop.prevent="onDrop"
      >
        <FileSpreadsheet class="text-primary pointer-events-none mx-auto size-10" />
        <div class="pointer-events-none space-y-1">
          <h2 class="text-heading">Drop your entry list here</h2>
          <p class="text-muted-foreground text-sm">An Excel, Google Sheets or CSV file. Or paste the cells.</p>
        </div>
        <div class="flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="lg" :disabled="!canEdit" :busy="reading" @click="fileInput?.click()">
            {{ reading ? 'Reading…' : 'Choose a file' }}
          </Button>
          <Button size="lg" :disabled="!canEdit" @click="paste"><ClipboardPaste /> Paste</Button>
        </div>
        <input ref="fileInput" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr-only" tabindex="-1" @change="onFile" />
        <p v-if="readError" class="text-destructive text-sm font-medium">{{ readError }}</p>
      </section>

      <section v-if="pasting" class="space-y-3">
        <textarea
          ref="pasteBox"
          v-model="pasted"
          rows="6"
          aria-label="Cells to import"
          placeholder="Number	First name	Last name	Location	Age group"
          class="field w-full rounded-xl p-3 font-mono text-sm"
        />
        <Button variant="primary" :disabled="!pasted.trim()" @click="usePasted()">Use these cells</Button>
      </section>
    </template>

    <!-- Step 2 -->
    <template v-else>
      <section class="flex flex-wrap items-center gap-3">
        <p class="min-w-0 flex-1 text-base font-medium">
          <FileSpreadsheet class="text-primary mr-1 inline size-5 align-text-bottom" /> {{ sourceName }}
        </p>
        <label v-if="sheets.length > 1" class="flex items-center gap-2 text-sm font-medium">
          Sheet
          <span class="relative">
            <select v-model="sheetIndex" class="field h-11 appearance-none rounded-xl pr-9 pl-3 text-callout">
              <option v-for="(s, i) in sheets" :key="s.sheet" :value="i">{{ s.sheet }}</option>
            </select>
            <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          </span>
        </label>
        <Button variant="plain" @click="startOver"><RotateCcw /> Choose another</Button>
      </section>

      <p v-if="!parsed || !parsed.dancers.length" class="bg-destructive/10 text-destructive rounded-2xl p-4 text-base font-medium">
        No dancers found{{ sheets.length > 1 ? ' on this sheet' : '' }}. Check it has a number in the first column, or a row of headings like Number, First name, Last name.
      </p>

      <template v-else-if="plan">
        <!-- What each column became -->
        <section class="space-y-2">
          <div class="-mx-4 overflow-x-auto px-4">
            <table class="text-callout">
              <thead>
                <tr>
                  <th v-for="c in fileColumns" :key="c.index" class="pr-2 pb-1 text-left font-normal">
                    <span class="relative block">
                      <select
                        :value="c.field"
                        :aria-label="`${c.name} column`"
                        :class="['field h-11 w-full min-w-32 appearance-none rounded-xl pr-9 pl-3', !c.field && 'text-muted-foreground']"
                        @change="setColumn(c.index, ($event.target as HTMLSelectElement).value as TableField | '')"
                      >
                        <option value="">Not used</option>
                        <option v-for="[f, label] in c.options" :key="f" :value="f">{{ label }}</option>
                      </select>
                      <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody class="text-muted-foreground">
                <tr v-for="(r, i) in sampleRows" :key="i">
                  <td v-for="c in fileColumns" :key="c.index" class="max-w-56 truncate py-1 pr-2 pl-3">{{ r[c.index] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="missingColumns.length" class="text-destructive text-sm font-medium">
            Choose the {{ missingColumns.length === 1 ? 'column' : 'columns' }} with the dancers’
            {{ missingColumns.length > 1 ? `${missingColumns.slice(0, -1).join(', ')} and ${missingColumns.at(-1)}` : missingColumns[0] }}.
          </p>
          <button
            v-if="wholeNames"
            type="button"
            role="checkbox"
            :aria-checked="splitNames"
            class="press-row focus-inset -mx-4 flex w-[calc(100%+2rem)] items-start gap-3 p-4 text-left"
            @click="splitNames = !splitNames"
          >
            <Checkbox :checked="splitNames" class="mt-0.5" />
            <span>
              <span class="block text-base font-medium">Split whole names into first and last name</span>
              <span class="text-muted-foreground block text-sm">
                Each name is all in one column. The first word becomes the first name and the rest the last name: “{{ wholeNameExample.name }}” becomes first name
                “{{ wholeNameExample.firstName }}”, last name “{{ wholeNameExample.lastName }}”.
              </span>
            </span>
          </button>
          <div v-if="capitals" class="flex items-start gap-3">
            <CaseSensitive class="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              <span class="block text-base font-medium">Names in capitals are saved as they’re spelled</span>
              <span class="text-muted-foreground block text-sm">
                <template v-if="capitalsExample">“{{ capitalsExample.typed }}” is saved as “{{ capitalsExample.spelled }}”. </template>Capitals can’t tell MacKenzie
                from Mackenzie, so check the names below, and next time please type them as they’re spelled.
              </span>
            </p>
          </div>
        </section>

        <!-- Each entry, as the Dancers list will show it -->
        <section v-for="[name, entries] in byGroup" :key="name" class="space-y-1">
          <h2 class="text-muted-foreground px-1 text-footnote font-semibold">{{ name || 'No age group' }}</h2>
          <ul class="rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]">
            <li v-for="d in entries" :key="d.source.row" class="flex items-start gap-3 px-4 py-2.5">
              <NumberTile :num="d.source.number" class="mt-0.5" />
              <div class="min-w-0 flex-1">
                <p class="text-base font-semibold break-words">{{ nameOf(d) }}</p>
                <p v-if="lineOf(d)" class="text-muted-foreground text-sm break-words">{{ lineOf(d) }}</p>
                <p v-for="e in d.errors" :key="e" class="text-destructive text-sm font-medium">{{ e }}: it’ll be left out.</p>
                <p v-for="(change, field) in d.changes" :key="field" class="text-muted-foreground text-sm">
                  {{ field }}: <span class="line-through">{{ change[0] || 'empty' }}</span> → {{ change[1] || 'empty' }}
                </p>
              </div>
              <span v-if="d.status === 'changed'" class="bg-blue-paper text-primary shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold">Changed</span>
            </li>
          </ul>
        </section>

        <!-- Dancers not in the file -->
        <button
          v-if="plan.missing.length"
          type="button"
          role="checkbox"
          :aria-checked="removeMissing"
          class="press-row focus-inset -mx-4 flex w-[calc(100%+2rem)] items-start gap-3 p-4 text-left"
          @click="removeMissing = !removeMissing"
        >
          <Checkbox :checked="removeMissing" class="mt-0.5" />
          <span>
            <span class="block text-base font-medium">Remove {{ plan.missing.length }} {{ plan.missing.length === 1 ? 'dancer who isn’t' : 'dancers who aren’t' }} in this file</span>
            <span class="text-muted-foreground block text-sm">{{ plan.missing.slice(0, 12).map((d) => `${d.num} ${d.label}`).join(', ') }}{{ plan.missing.length > 12 ? '…' : '' }}</span>
            <span v-if="missingWithResults" class="text-destructive block text-sm font-medium">
              {{ missingWithResults === 1 && plan.missing.length === 1 ? 'They have' : `${missingWithResults} of them ${missingWithResults === 1 ? 'has' : 'have'}` }} results entered. Those places would show as an unknown dancer (?).
            </span>
          </span>
        </button>

        <div class="glass sticky bottom-[calc(var(--safe-bottom)+0.75rem)] flex flex-wrap items-center gap-3 rounded-2xl py-2 pr-2 pl-4">
          <p class="min-w-0 flex-1 text-sm">
            <span class="font-semibold">{{ summary }}</span>
            <span v-if="errors" class="text-destructive"> · {{ errors }} left out</span>
          </p>
          <Button variant="primary" size="lg" :disabled="!canEdit || !writes" :busy="importing" @click="doImport">
            {{ importLabel }}
          </Button>
        </div>
      </template>
    </template>

    <!-- What a list should look like: there to look up, and open when one couldn't be read. -->
    <details :open="unreadable" class="space-y-3">
      <summary class="text-primary cursor-pointer text-sm font-semibold">See what lists look like</summary>
      <div class="mt-3 grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <p class="text-sm font-semibold">An age group heading, then its dancers</p>
          <table class="bg-card w-full overflow-hidden rounded-lg text-sm shadow-(--shadow-card)">
            <tbody class="divide-y">
              <tr><td colspan="4" class="px-2 py-1 font-semibold">Premier 12 &amp; Under 14 Years</td></tr>
              <tr><td class="px-2 py-1 font-mono">301</td><td class="px-2 py-1">Ava</td><td class="px-2 py-1">Reid</td><td class="px-2 py-1">Calgary</td></tr>
              <tr><td class="px-2 py-1 font-mono">302</td><td class="px-2 py-1">Mia</td><td class="px-2 py-1">Lee</td><td class="px-2 py-1">Edmonton</td></tr>
              <tr><td colspan="4" class="px-2 py-1 font-semibold">Choreography Duet</td></tr>
              <tr><td class="px-2 py-1 font-mono">401</td><td class="px-2 py-1">Ava Reid &amp;</td><td class="px-2 py-1">Mia Lee</td><td class="px-2 py-1">Calgary</td></tr>
            </tbody>
          </table>
        </div>
        <div class="space-y-2">
          <p class="text-sm font-semibold">Or a table with headings</p>
          <table class="bg-card w-full overflow-hidden rounded-lg text-sm shadow-(--shadow-card)">
            <tbody class="divide-y">
              <tr class="font-semibold"><td class="px-2 py-1">Number</td><td class="px-2 py-1">First name</td><td class="px-2 py-1">Last name</td><td class="px-2 py-1">Age group</td></tr>
              <tr><td class="px-2 py-1 font-mono">301</td><td class="px-2 py-1">Ava</td><td class="px-2 py-1">Reid</td><td class="px-2 py-1">Premier 12 &amp; Under 14</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="text-muted-foreground mt-3 text-sm">A duet or group is its dancers’ names joined by “&amp;”, or a row for each dancer with the same number.</p>
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="plain" class="-ml-4" href="/examples/ScotDance-Import-Template.xlsx" download><Download /> Download a template</Button>
        <p class="text-muted-foreground text-sm">
          Entries from Eventry or HD Comps? The
          <a href="https://toolkit.scotdance.app/#splits" target="_blank" rel="noopener" class="text-primary font-semibold">ScotDance Toolkit</a>
          gets them ready to send here.
        </p>
      </div>
    </details>
  </div>
</template>
