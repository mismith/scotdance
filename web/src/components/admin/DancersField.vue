<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { Plus, X } from '@lucide/vue'
import AdminField from '@/components/admin/AdminField.vue'
import NameCell from '@/components/admin/NameCell.vue'
import NameSuggestions from '@/components/admin/NameSuggestions.vue'
import { useManagedCompetition, type MDancer } from '@/composables/admin/useManagedCompetition'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { draftName, membersToList, type MemberDraft } from '@/lib/admin/teamMembers'
import { planSetDancerName, planSetDancers, planTakeOffTeam } from '@shared/plans/dancers'
import { namesDancingHere, suggestNames, type NameSuggestion } from '@/lib/admin/nameSuggestions'
import { splitMembers, splitName } from '@/lib/admin/memberNames'
import { isTeam } from '@/lib/entries'

// An entry's dancers (ADR 0012). One dancer is a first and a last name, as
// ever. "Add another dancer" (in the form's row of "+ Add" buttons, see
// `addDancer`) makes it a duet, a trio or a group: the names become a list
// of rows. Taking dancers off down to one makes it a dancer again. As a name
// is typed, the names dancing here that fit it show under it: "Ava" offers
// "Ava Reid · 101", and choosing one fills the row.
//
// Without `item` it's the add form's (v-model); with it, every change saves.

const props = defineProps<{
  /** The add form's dancers (without `item`). */
  modelValue?: MemberDraft[]
  /** The saved entry being edited. */
  item?: MDancer
  error?: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [rows: MemberDraft[]] }>()

const m = useManagedCompetition()
const id = useId()
const busy = ref(false)
const cellError = ref<string | null>(null)

// --- The dancers
interface Row extends MemberDraft {
  /** Typed but not saved yet (editing): a new dancer's row. */
  pending?: boolean
}
const savedTeam = computed(() => (props.item ? isTeam(props.item) : false))
const saved = computed<MemberDraft[]>(() => {
  const d = props.item
  if (!d) return []
  return savedTeam.value ? membersToList(d.members) : [{ firstName: d.firstName ?? '', lastName: d.lastName ?? '' }]
})
const pending = ref<MemberDraft[]>([])
const rows = computed<Row[]>(() => (props.item ? [...saved.value, ...pending.value.map((r) => ({ ...r, pending: true }))] : (props.modelValue ?? [])))
/** Several dancers: shown as a list of rows. */
const several = computed(() => savedTeam.value || rows.value.length > 1)
const filled = (list: MemberDraft[]) => list.filter((r) => draftName(r))

// --- Saving (editing)
async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  busy.value = true
  try {
    return await fn()
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = false
  }
}
const undoable = (change: unknown, message: string) =>
  change != null && toast(message, { action: { label: 'Undo', run: () => m.undoChange(change as Parameters<typeof m.undoChange>[0]) } })

async function saveDancers(list: MemberDraft[], label?: string) {
  const { plan, outcome, ensemble: word, alone } = planSetDancers(m.state.value, props.item!.id, list, m.newKey, label)
  const change = await run(() => m.writeData(plan.data, plan.summary))
  if (outcome === 'one') {
    undoable(change, `${alone} is dancing on their own`)
    return
  }
  if (outcome === 'became') undoable(change, `Made a ${word}`)
  return change
}

/** One name of a saved dancer's row, as typed. */
function saveCell(i: number, part: 'firstName' | 'lastName') {
  return (value: string) => saveDancers(saved.value.map((r, n) => (n === i ? { ...r, [part]: value } : r)))
}

/** A dancer's own name (one dancer). */
const saveOwn = (part: 'firstName' | 'lastName') => (value: string) => {
  const { data, summary } = planSetDancerName(m.state.value, props.item!.id, part, value)
  return m.writeData(data, summary)
}

/** New dancers' rows, once each has a first name. */
let committing = false
async function commitPending() {
  const ready = filled(pending.value)
  if (committing || !ready.length || pending.value.some((r) => !r.firstName.trim() && r.lastName.trim())) return
  committing = true
  try {
    await saveDancers([...saved.value, ...ready])
    pending.value = []
  } finally {
    committing = false
  }
}

// --- Changing the rows
function setRows(list: MemberDraft[]) {
  if (!props.item) emit('update:modelValue', list)
  else pending.value = list.slice(saved.value.length)
}
function edit(i: number, part: 'firstName' | 'lastName', value: string) {
  setRows(rows.value.map((r, n) => (n === i ? { ...r, [part]: value } : r)))
}
/** "Add another dancer": a new row, focused. */
async function addDancer() {
  setRows([...rows.value, { firstName: '', lastName: '' }])
  await nextTick()
  document.getElementById(`${id}-${rows.value.length - 1}-first`)?.focus()
}
async function remove(i: number) {
  const r = rows.value[i]
  if (!props.item || r.pending) {
    setRows(rows.value.filter((_, n) => n !== i))
    return
  }
  const { plan, outcome, alone } = planTakeOffTeam(m.state.value, props.item.id, i, m.newKey)
  const change = await run(() => m.writeData(plan.data, plan.summary))
  undoable(change, outcome === 'one' ? `${alone} is dancing on their own` : `Took ${draftName(r) || 'a dancer'} off`)
}

// --- Names dancing here, as one's typed
const here = computed(() => namesDancingHere(m.dancers.value.filter((d) => d.id !== props.item?.id)))
/** The row being typed in, as typed. */
const typing = ref<{ i: number; part: 'firstName' | 'lastName'; firstName: string; lastName: string } | null>(null)
const active = ref(-1)
const listId = `${id}-names`
function onTyped(i: number, part: 'firstName' | 'lastName', value: string) {
  const r = typing.value?.i === i ? typing.value : { i, firstName: rows.value[i]?.firstName ?? '', lastName: rows.value[i]?.lastName ?? '' }
  typing.value = { ...r, part, [part]: value }
  active.value = -1
}
const suggestions = computed(() => {
  const t = typing.value
  if (!t) return []
  return suggestNames(t, here.value, rows.value.filter((_, n) => n !== t.i).map(draftName).filter(Boolean))
})
const listFor = (i: number) => (typing.value?.i === i && suggestions.value.length ? listId : '')
/** One dancer's names, side by side or stacked: under the box being typed in. */
const listUnder = (part: 'firstName' | 'lastName') => !!listFor(0) && typing.value?.part === part
const activeFor = (i: number) => (listFor(i) && active.value >= 0 ? `${listId}-${active.value}` : undefined)
function closeNames() {
  typing.value = null
  active.value = -1
}

const cells = new Map<string, { revert: () => void }>()
const cellRef = (key: string) => (c: unknown) => (c ? cells.set(key, c as { revert: () => void }) : cells.delete(key))
async function pick(s: NameSuggestion) {
  const i = typing.value?.i
  closeNames()
  if (i == null) return
  const named = (list: MemberDraft[]) => list.map((r, n) => (n === i ? { ...r, firstName: s.firstName, lastName: s.lastName } : r))
  const r = rows.value[i]
  if (!props.item || r?.pending) {
    setRows(named(rows.value))
    if (r?.pending) await commitPending()
  } else {
    // What was typed gives way to the name chosen, without saving it first.
    cells.get(`${i}-first`)?.revert()
    cells.get(`${i}-last`)?.revert()
    await saveDancers(named(saved.value))
  }
}

// A pasted list fans out into rows; a pasted full name splits itself.
function onPaste(e: ClipboardEvent, i: number) {
  const text = e.clipboardData?.getData('text') ?? ''
  const r = rows.value[i]
  const list = /[\n\t,;&+/]|\band\b/i.test(text.trim())
  const fullName = !list && text.trim().split(/\s+/).length > 1 && !r.firstName && !r.lastName
  if (!list && !fullName) return
  e.preventDefault()
  const names = (list ? splitMembers(text).names : [text.trim()]).map(splitName)
  if (!names.length) return
  if (props.item && !r.pending) setRows([...rows.value, ...names])
  else setRows([...rows.value.slice(0, i), ...(draftName(r) ? [r] : []), ...names, ...rows.value.slice(i + 1)])
}
function onKeydown(e: KeyboardEvent, i: number, part: 'firstName' | 'lastName') {
  const n = listFor(i) ? suggestions.value.length : 0
  if (n && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault()
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
    return
  }
  if (n && e.key === 'Enter' && active.value >= 0 && !e.isComposing) {
    e.preventDefault()
    void pick(suggestions.value[active.value])
    return
  }
  if (n && e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closeNames()
    return
  }
  const r = rows.value[i]
  // Backspace in an empty row's first name takes the row away.
  if (e.key === 'Backspace' && part === 'firstName' && !r.firstName && !r.lastName && rows.value.length > 1 && (!props.item || r.pending)) {
    e.preventDefault()
    setRows(rows.value.filter((_, n) => n !== i))
    void nextTick(() => document.getElementById(`${id}-${i - 1}-last`)?.focus())
  }
  if (e.key === 'Enter' && r.pending) {
    e.preventDefault()
    void commitPending()
  }
}
// Leaving a row closes its names; leaving a new dancer's row saves it.
function onRowLeave(e: FocusEvent, i: number) {
  const to = e.relatedTarget as Node | null
  if (to && (e.currentTarget as HTMLElement).contains(to)) return
  if (typing.value?.i === i) closeNames()
  if (rows.value[i]?.pending) void commitPending()
}

const label = (i: number, part: string) => (i === 0 ? part : `${part}, dancer ${i + 1}`)
const PARTS = [
  { key: 'firstName', id: 'first', label: 'First name', required: true },
  { key: 'lastName', id: 'last', label: 'Last name', required: false },
] as const


defineExpose({ addDancer, several })
</script>

<template>
  <!-- One dancer: their name, as ever. -->
  <div v-if="!several" class="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2" @focusout="(e: FocusEvent) => onRowLeave(e, 0)">
    <AdminField v-for="part in PARTS" :key="part.key" v-slot="{ describedby }" :label="part.label" :for="`${id}-0-${part.id}`" :required="part.required" :error="part.required ? error || cellError : null">
      <div class="relative">
        <NameCell
          :id="`${id}-0-${part.id}`"
          :ref="cellRef(`0-${part.id}`)"
          boxed
          :describedby="describedby"
          :model-value="rows[0]?.[part.key] ?? ''"
          :label="part.label"
          :required="part.required"
          :save="item ? saveOwn(part.key) : undefined"
          :disabled="!canEdit"
          :list="listUnder(part.key) ? listId : ''"
          :active="listUnder(part.key) ? activeFor(0) : undefined"
          @update:model-value="(v: string) => edit(0, part.key, v)"
          @typed="(v: string) => onTyped(0, part.key, v)"
          @error="(e) => (cellError = e)"
          @paste="(e) => onPaste(e, 0)"
          @keydown="(e) => onKeydown(e, 0, part.key)"
        />
        <NameSuggestions v-if="listUnder(part.key)" :id="listId" :suggestions="suggestions" :active="active" @pick="pick" />
      </div>
    </AdminField>
  </div>

  <!-- Several: one row each. -->
  <AdminField v-else :label="`Dancers (${filled(rows).length || rows.length})`" :for="`${id}-0-first`" :error="error || cellError">
    <div class="field rounded-xl" :aria-busy="busy || undefined">
      <ul class="divide-y">
        <li v-for="(r, i) in rows" :key="r.key ?? `row-${i}`" class="relative" @focusout="(e: FocusEvent) => onRowLeave(e, i)">
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] items-center">
            <NameCell
              v-for="part in PARTS"
              :id="`${id}-${i}-${part.id}`"
              :key="part.key"
              :ref="cellRef(`${i}-${part.id}`)"
              :model-value="r[part.key]"
              :label="label(i, part.label)"
              :placeholder="part.label"
              :class="part.key === 'lastName' && 'border-l'"
              :save="item && !r.pending ? saveCell(i, part.key) : undefined"
              :disabled="!canEdit"
              :list="listFor(i)"
              :active="activeFor(i)"
              @update:model-value="(v: string) => edit(i, part.key, v)"
              @typed="(v: string) => onTyped(i, part.key, v)"
              @error="(e) => (cellError = e)"
              @paste="(e) => onPaste(e, i)"
              @keydown="(e) => onKeydown(e, i, part.key)"
            />
            <button
              v-if="rows.length > 1"
              type="button"
              class="press text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
              :aria-label="`Take ${draftName(r) || `dancer ${i + 1}`} off`"
              :disabled="!canEdit || busy"
              @click="remove(i)"
            >
              <X class="size-5" />
            </button>
          </div>
          <NameSuggestions v-if="listFor(i)" :id="listId" :suggestions="suggestions" :active="active" @pick="pick" />
        </li>
      </ul>
      <button
        type="button"
        class="press-row focus-inset text-primary flex min-h-12 w-full items-center gap-2 rounded-none rounded-b-xl border-t px-3 font-semibold"
        :disabled="!canEdit || busy"
        @click="addDancer"
      >
        <Plus class="size-5" aria-hidden="true" /> Add another dancer
      </button>
    </div>
  </AdminField>
</template>
