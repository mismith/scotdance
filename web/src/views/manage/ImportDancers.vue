<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { ChevronDown, ClipboardPaste, Download, FileSpreadsheet, RotateCcw } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { toast } from '@/lib/admin/feedback'
import { goUp } from '@/lib/back'
import { canEdit, friendlyError } from '@/lib/admin/write'
import {
  decodeText,
  gridFromSheet,
  gridFromText,
  guessColumns,
  headerRowOf,
  parseGrid,
  parseTable,
  pickSheet,
  planImport,
  planUpdates,
  type Grid,
  type RowStatus,
  type TableField,
} from '@/lib/admin/importDancers'

const m = useManagedCompetition()
const router = useRouter()

// --- Step 1: where the list comes from
const sheets = ref<Array<{ sheet: string; grid: Grid }>>([])
const sheetIndex = ref(0)
const sourceName = ref('')
const reading = ref(false)
const readError = ref<string | null>(null)
const pasted = ref('')
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
function usePasted() {
  if (!pasted.value.trim()) return
  sheets.value = [{ sheet: 'Pasted', grid: gridFromText(pasted.value) }]
  sheetIndex.value = 0
  sourceName.value = 'Pasted cells'
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
  pasted.value = ''
  readError.value = null
  filter.value = 'all'
  removeMissing.value = false
  columnOverrides.value = null
}

// --- Step 2: reading it
const grid = computed(() => sheets.value[sheetIndex.value]?.grid ?? [])
const columnOverrides = ref<Record<TableField, number> | null>(null)
// Columns chosen for one sheet don't fit another.
watch(sheetIndex, () => (columnOverrides.value = null))
const parsed = computed(() => {
  const base = parseGrid(grid.value)
  if (!base || base.layout === 'program' || !columnOverrides.value) return base
  return { ...base, columns: columnOverrides.value, dancers: parseTable(grid.value, headerRowOf(grid.value), columnOverrides.value) }
})
const columns = computed(() => columnOverrides.value ?? parsed.value?.columns ?? null)
function setColumn(field: TableField, index: number) {
  const base = columns.value ?? guessColumns(parsed.value?.headers ?? [])
  columnOverrides.value = { ...base, [field]: index }
}
// What a table still needs a column for (nothing matched its heading).
const missingColumns = computed(() => {
  const c = columns.value
  if (!c || parsed.value?.layout !== 'table') return []
  return [c.number < 0 && 'numbers', c.firstName < 0 && c.lastName < 0 && c.fullName < 0 && 'names', c.group < 0 && c.category < 0 && 'age groups'].filter(
    (x): x is string => !!x,
  )
})
const FIELD_LABELS: Array<[TableField, string]> = [
  ['number', 'Number'],
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['fullName', 'Full name'],
  ['location', 'Location'],
  ['group', 'Age group'],
  ['category', 'Category'],
]

const existing = computed(() => ({
  categories: m.categories.value.map((c) => ({ id: c.id, name: c.name })),
  groups: m.groups.value.map((g) => ({ id: g.id, name: g.name, categoryId: g.categoryId })),
  dancers: m.dancers.value.map((d) => ({ id: d.id, num: d.num, firstName: d.firstName, lastName: d.lastName, location: d.location, groupId: d.groupId, label: d.label })),
}))
const plan = computed(() => (parsed.value ? planImport(parsed.value.dancers, existing.value) : null))

const filter = ref<RowStatus | 'all'>('all')
const shownRows = computed(() => (plan.value?.dancers ?? []).filter((d) => filter.value === 'all' || d.status === filter.value))
const STATUS: Record<RowStatus, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-done text-done-foreground' },
  changed: { label: 'Changed', cls: 'bg-blue-paper text-primary' },
  same: { label: 'No change', cls: 'bg-muted text-muted-foreground' },
  error: { label: 'Needs fixing', cls: 'bg-destructive/10 text-destructive' },
}

const removeMissing = ref(false)
const writes = computed(() => {
  if (!plan.value) return 0
  return plan.value.counts.new + plan.value.counts.changed + (removeMissing.value ? plan.value.missing.length : 0)
})
const importLabel = computed(() => {
  const p = plan.value
  if (!p || !writes.value) return 'Nothing to change'
  const n = p.counts.new + p.counts.changed
  const plural = (k: number) => (k === 1 ? 'dancer' : 'dancers')
  return n ? `Import ${n} ${plural(n)}` : `Remove ${p.missing.length} ${plural(p.missing.length)}`
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

// Rows as a table where there's room, else as cards (nothing scrolls sideways).
const wide = useMediaQuery('(min-width: 640px)')
const nameOf = (d: { source: { firstName: string; lastName: string } }) => `${d.source.firstName} ${d.source.lastName}`.trim() || '–'
const groupOf = (d: { source: { category: string; group: string } }) => `${d.source.category} ${d.source.group}`.trim() || '–'

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
  <div class="max-w-4xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Import dancers"
      description="From your entry list in Excel or Google Sheets. You’ll see exactly what changes before anything is saved."
    />

    <!-- Step 1 -->
    <template v-if="!sheets.length">
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
          <h2 class="text-heading">Choose your entry list</h2>
          <p class="text-muted-foreground text-sm">An .xlsx or CSV file, from Excel or Google Sheets. You can also drag it here.</p>
        </div>
        <Button variant="primary" size="lg" :disabled="!canEdit" :busy="reading" @click="fileInput?.click()">
          {{ reading ? 'Reading…' : 'Choose a file' }}
        </Button>
        <input ref="fileInput" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr-only" tabindex="-1" @change="onFile" />
        <p v-if="readError" class="text-destructive text-sm font-medium">{{ readError }}</p>
      </section>

      <section class="space-y-3">
        <h2 class="text-heading">Or paste from a spreadsheet</h2>
        <p class="text-muted-foreground text-sm">Select the cells in Excel or Google Sheets, copy, and paste them here.</p>
        <textarea
          v-model="pasted"
          rows="6"
          placeholder="Number	First name	Last name	Location	Age group"
          class="field w-full rounded-xl p-3 font-mono text-sm"
        />
        <Button :disabled="!pasted.trim()" @click="usePasted">
          <ClipboardPaste /> Use these cells
        </Button>
      </section>

      <section class="bg-muted/60 space-y-3 rounded-2xl p-5">
        <h2 class="text-heading">What the list should look like</h2>
        <p class="text-muted-foreground text-sm">Either way works:</p>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <p class="text-sm font-semibold">An age group heading, then its dancers</p>
            <table class="bg-card w-full overflow-hidden rounded-lg text-sm shadow-(--shadow-card)">
              <tbody class="divide-y">
                <tr><td colspan="4" class="px-2 py-1 font-semibold">Premier 12 &amp; Under 14 Years</td></tr>
                <tr><td class="px-2 py-1 font-mono">301</td><td class="px-2 py-1">Ava</td><td class="px-2 py-1">Reid</td><td class="px-2 py-1">Calgary</td></tr>
                <tr><td class="px-2 py-1 font-mono">302</td><td class="px-2 py-1">Mia</td><td class="px-2 py-1">Lee</td><td class="px-2 py-1">Edmonton</td></tr>
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
        <Button variant="plain" class="-ml-4" href="/examples/ScotDance-Import-Template.xlsx" download>
          <Download /> Download a template
        </Button>
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
        <!-- Columns, for tables -->
        <section v-if="parsed.layout === 'table' && parsed.headers" class="space-y-2">
          <h2 class="text-heading">Columns</h2>
          <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <label v-for="[field, label] in FIELD_LABELS" :key="field" class="space-y-1">
              <span class="block text-sm font-medium">{{ label }}</span>
              <span class="relative block">
                <select
                  :value="columns?.[field] ?? -1"
                  class="field h-11 w-full appearance-none rounded-xl pr-9 pl-3 text-callout"
                  @change="setColumn(field, Number(($event.target as HTMLSelectElement).value))"
                >
                  <option :value="-1">Not in the file</option>
                  <option v-for="(h, i) in parsed.headers" :key="i" :value="i">{{ h || `Column ${i + 1}` }}</option>
                </select>
                <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
              </span>
            </label>
          </div>
          <p v-if="missingColumns.length" class="text-destructive text-sm font-medium">
            Choose the {{ missingColumns.length === 1 ? 'column' : 'columns' }} with the dancers’
            {{ missingColumns.length > 1 ? `${missingColumns.slice(0, -1).join(', ')} and ${missingColumns.at(-1)}` : missingColumns[0] }}.
          </p>
        </section>

        <!-- Summary -->
        <section class="space-y-3">
          <h2 class="text-heading">What will happen</h2>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Show">
            <button
              v-for="key in (['all', 'new', 'changed', 'same', 'error'] as const)"
              :key="key"
              type="button"
              role="radio"
              :aria-checked="filter === key"
              :class="['press min-h-11 rounded-full px-4 text-sm font-semibold', filter === key ? 'bg-primary-fill text-primary-foreground' : 'surface']"
              @click="filter = key"
            >
              {{ key === 'all' ? `All ${plan.dancers.length}` : `${STATUS[key].label} ${plan.counts[key]}` }}
            </button>
          </div>
          <ul v-if="plan.newCategories.length || plan.newGroups.length" class="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li v-if="plan.newCategories.length">New categories: {{ plan.newCategories.join(', ') }}</li>
            <li v-if="plan.newGroups.length">New age groups: {{ plan.newGroups.map((g) => `${g.category} ${g.group}`.trim()).join(', ') }}</li>
          </ul>
          <p v-if="plan.counts.error" class="text-destructive text-sm font-medium">
            {{ plan.counts.error }} {{ plan.counts.error === 1 ? 'row needs' : 'rows need' }} fixing and will be skipped. Fix them in the file and import again, or add them by hand afterwards.
          </p>
        </section>

        <!-- Rows: a table where there's room -->
        <div v-if="wide" class="surface overflow-x-auto rounded-2xl">
          <table class="w-full text-callout">
            <thead class="text-muted-foreground border-b text-left text-sm">
              <tr>
                <th class="px-3 py-2 font-medium">Row</th>
                <th class="px-3 py-2 font-medium"><span class="sr-only">Status</span></th>
                <th class="px-3 py-2 font-medium">Number</th>
                <th class="px-3 py-2 font-medium">Name</th>
                <th class="px-3 py-2 font-medium">Age group</th>
                <th class="px-3 py-2 font-medium">Location</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="d in shownRows.slice(0, 500)" :key="d.source.row" class="align-top">
                <td class="text-muted-foreground px-3 py-2 tabular-nums">{{ d.source.row }}</td>
                <td class="px-3 py-2"><span :class="['rounded-full px-2 py-0.5 text-sm font-semibold whitespace-nowrap', STATUS[d.status].cls]">{{ STATUS[d.status].label }}</span></td>
                <td class="px-3 py-2 font-mono font-semibold">{{ d.source.number || '–' }}</td>
                <td class="px-3 py-2">
                  {{ nameOf(d) }}
                  <p v-for="e in d.errors" :key="e" class="text-destructive text-sm font-medium">{{ e }}</p>
                  <p v-for="(change, field) in d.changes" :key="field" class="text-muted-foreground text-sm">
                    {{ field }}: <span class="line-through">{{ change[0] || 'empty' }}</span> → {{ change[1] || 'empty' }}
                  </p>
                </td>
                <td class="px-3 py-2">{{ groupOf(d) }}</td>
                <td class="px-3 py-2">{{ d.source.location }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="shownRows.length > 500" class="text-muted-foreground border-t p-3 text-sm">Showing the first 500 rows.</p>
        </div>
        <!-- …and on a phone, a card each, nothing cut off -->
        <ul v-else class="surface divide-y overflow-hidden rounded-2xl">
          <li v-for="d in shownRows.slice(0, 500)" :key="d.source.row" class="space-y-1 px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="bg-paper text-paper-ink min-w-10 rounded-md border px-1.5 py-0.5 text-center font-mono text-sm font-semibold">{{ d.source.number || '–' }}</span>
              <span class="min-w-0 flex-1 truncate text-base font-medium">{{ nameOf(d) }}</span>
              <span :class="['rounded-full px-2 py-0.5 text-sm font-semibold whitespace-nowrap', STATUS[d.status].cls]">{{ STATUS[d.status].label }}</span>
            </div>
            <p class="text-muted-foreground text-sm">{{ [groupOf(d), d.source.location, `Row ${d.source.row}`].filter(Boolean).join(' · ') }}</p>
            <p v-for="e in d.errors" :key="e" class="text-destructive text-sm font-medium">{{ e }}</p>
            <p v-for="(change, field) in d.changes" :key="field" class="text-muted-foreground text-sm">
              {{ field }}: <span class="line-through">{{ change[0] || 'empty' }}</span> → {{ change[1] || 'empty' }}
            </p>
          </li>
          <li v-if="shownRows.length > 500" class="text-muted-foreground p-3 text-sm">Showing the first 500 rows.</li>
        </ul>

        <!-- Dancers not in the file -->
        <button
          v-if="plan.missing.length"
          type="button"
          role="checkbox"
          :aria-checked="removeMissing"
          class="surface press-row focus-inset flex w-full items-start gap-3 rounded-2xl p-4 text-left"
          @click="removeMissing = !removeMissing"
        >
          <Checkbox :checked="removeMissing" class="mt-0.5" />
          <span>
            <span class="block text-base font-medium">Remove {{ plan.missing.length }} {{ plan.missing.length === 1 ? 'dancer who isn’t' : 'dancers who aren’t' }} in this file</span>
            <span class="text-muted-foreground block text-sm">{{ plan.missing.slice(0, 12).map((d) => `${d.num} ${d.label}`).join(', ') }}{{ plan.missing.length > 12 ? '…' : '' }}</span>
            <span v-if="missingWithResults" class="text-destructive block text-sm font-medium">
              {{ missingWithResults === 1 && plan.missing.length === 1 ? 'They have' : `${missingWithResults} of them have` }} results entered. Those places would show as an unknown dancer (?).
            </span>
          </span>
        </button>

        <div class="glass sticky bottom-[calc(var(--safe-bottom)+0.75rem)] flex flex-wrap items-center gap-3 rounded-2xl py-2 pr-2 pl-4">
          <p class="text-muted-foreground min-w-0 flex-1 text-sm">You can undo the import straight after.</p>
          <Button variant="primary" size="lg" :disabled="!canEdit || !writes" :busy="importing" @click="doImport">
            {{ importLabel }}
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
