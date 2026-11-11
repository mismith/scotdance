<script setup lang="ts" generic="T extends CollectionItem">
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { ChevronRight, FileSpreadsheet, GripVertical, ListPlus, Lock, Plus, Trash2, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import MovingList from '@/components/admin/MovingList.vue'
import SearchField from '@/components/admin/SearchField.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import SwipeRow from '@/components/admin/SwipeRow.vue'
import TextField from '@/components/admin/TextField.vue'
import SelectField from '@/components/admin/SelectField.vue'
import ImageField from '@/components/admin/ImageField.vue'
import SharedSheet from '@/components/admin/SharedSheet.vue'
import SharedValue from '@/components/admin/SharedValue.vue'
import FormInput from '@/components/admin/FormInput.vue'
import NumberTile from '@/components/admin/NumberTile.vue'
import NumberCard from '@/components/NumberCard.vue'
import DancersField from '@/components/admin/DancersField.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSharedSheet } from '@/composables/admin/useSharedParts'
import { useSplit } from '@/composables/admin/useWide'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { LINK_PROBLEM, looksLikeLink, type CollectionItem, type CollectionSpec, type FieldSpec } from '@/lib/admin/collection'
import { htmlToText } from '@/lib/admin/richText'
import { ALL_SECTIONS } from '@/lib/admin/sections'
import { useMorph } from '@/lib/morph'
import { planAdd, planAddPresets, planRemove, planReorder, planSetField, planSetFieldOn } from '@shared/plans/collection'
import type { LinkPart } from '@/lib/linked'

// One editable list: search, select several to change or delete at once,
// drag to reorder (or move from the keyboard), swipe one left to delete it,
// add one (or many, from presets or one after another), and edit the chosen
// item beside the list. Every change saves straight away; deletes can be
// undone from the toast.

const props = defineProps<{
  spec: CollectionSpec<T>
  items: T[]
  /**
   * Shared from a linked competition's main one (ADR 0007): shown, locked,
   * and changed there. No adding, moving or deleting; tapping says why.
   */
  shared?: LinkPart
}>()

const slots = defineSlots<{
  /** More ways to add (Import…), as a Button of the given variant to sit with the others. */
  'list-actions'?: (p: { variant: 'primary' | 'secondary' }) => unknown
  'detail-extra'?: (p: { item: T }) => unknown
  'list-intro'?: () => unknown
  /** Above the list, empty or not (why it's read-only, say). */
  notice?: () => unknown
}>()

const route = useRoute()
const router = useRouter()
const m = useManagedCompetition()
const split = useSplit()
const readonly = computed(() => !!props.shared)
const sheet = useSharedSheet()

// A list can hold more than one kind (dancers and teams): each item, and the
// add form, shows its own kind's fields.
const fieldsOf = (values: object) => props.spec.fieldsFor?.(values as Record<string, unknown>) ?? props.spec.fields
const singularOf = (values: object) => props.spec.singularFor?.(values as Record<string, unknown>) ?? props.spec.singular

const itemId = computed(() => (route.params.itemId ? String(route.params.itemId) : null))
const adding = computed(() => itemId.value === 'new')
const current = computed(() => (itemId.value && !adding.value ? (props.items.find((i) => i.id === itemId.value) ?? null) : null))
const showDetail = computed(() => !!itemId.value)

const itemRoute = (id: string) => ({ name: props.spec.route, params: { competitionId: m.competitionId.value, itemId: id } })
const listRoute = computed(() => ({ name: props.spec.route, params: { competitionId: m.competitionId.value } }))
const importRoute = computed(() => ({ name: 'manage.dancers.import', params: { competitionId: m.competitionId.value } }))

// After adding or deleting, the page left behind (the add form, the deleted
// item) mustn't stay in the history for the phone's Back to land on.
async function leaveFor(to: ReturnType<typeof itemRoute> | typeof listRoute.value) {
  if ((window.history.state as { back?: string } | null)?.back === router.resolve(to).fullPath) router.back()
  else await router.replace(to)
}

// --- Search
const query = ref('')
// Accents and curly apostrophes don't matter: "o'neill" finds O’Neill, "o briain" Ó Briain.
const normalised = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’`´]/g, "'").toLowerCase()
const filtered = computed(() => {
  const q = normalised(query.value.trim())
  if (!q) return props.items
  return props.items.filter((i) =>
    normalised([props.spec.title(i), props.spec.subtitle?.(i) ?? '', props.spec.badge?.(i) ?? '', props.spec.searchText?.(i) ?? ''].join(' ')).includes(q),
  )
})
// A search swaps the whole list at once: that shouldn't animate row by row.
const hushed = ref(false)
watch(query, () => {
  hushed.value = true
  void nextTick(() => (hushed.value = false))
})

// --- Reordering (only while not searching or selecting)
const order = shallowRef<T[]>([])
const dragging = ref(false)
/** Picked up from the keyboard: its id. */
const lifted = ref<string | null>(null)
watch(
  () => props.items,
  (items) => {
    if (!dragging.value && !lifted.value) order.value = [...items]
  },
  { immediate: true },
)
const canReorder = computed(() => !!props.spec.sortable && !readonly.value && !query.value.trim() && !selecting.value && canEdit.value)
// Where a row's text starts (after the grip or margin, a tick box while
// selecting, and a number tile), so the hairlines between rows start there too.
const listInset = computed(() => {
  const tile = !!props.spec.badge
  if (selecting.value) return tile ? '[--inset:6.875rem]' : '[--inset:3.125rem]'
  if (canReorder.value) return tile ? '[--inset:6.25rem]' : '[--inset:2.5rem]'
  return tile ? '[--inset:4.75rem]' : '[--inset:1rem]'
})

async function saveOrder() {
  const { data: updates, summary } = planReorder(props.spec.path, order.value)
  // Dropped where it started: nothing to save (or to undo).
  if (!Object.keys(updates).length) return
  try {
    await m.writeData(updates, summary)
  } catch (e) {
    order.value = [...props.items]
    toast(friendlyError(e), { tone: 'error' })
  }
}

async function onDragEnd() {
  // The drop is already in place: let the list settle before it glides again.
  await nextTick()
  dragging.value = false
  await saveOrder()
}

// From the keyboard, like the schedule's chips: Space or Enter picks a row
// up, the arrow keys move it, Space or Enter drops it, Escape puts it back.
const announcement = ref('')
let movingFocus = false
function focusHandle(id: string) {
  movingFocus = true
  void nextTick(() => {
    document.querySelector<HTMLElement>(`[data-handle-for="${CSS.escape(id)}"]`)?.focus()
    movingFocus = false
  })
}
async function onHandleKey(e: KeyboardEvent, item: T) {
  const name = props.spec.title(item)
  const at = order.value.findIndex((i) => i.id === item.id)
  const place = (i: number) => `${i + 1} of ${order.value.length}`
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (lifted.value !== item.id) {
      lifted.value = item.id
      announcement.value = `Picked up ${name}, ${place(at)}. Use the arrow keys to move it, Space to drop it, Escape to put it back.`
    } else {
      lifted.value = null
      announcement.value = `Dropped ${name} at ${place(at)}.`
      await saveOrder()
    }
  } else if (lifted.value === item.id && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    const to = at + (e.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= order.value.length) return
    const next = [...order.value]
    next.splice(to, 0, ...next.splice(at, 1))
    order.value = next
    announcement.value = place(to)
    focusHandle(item.id)
  } else if (lifted.value === item.id && e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    putBack(item)
  }
}
function putBack(item: T) {
  lifted.value = null
  order.value = [...props.items]
  announcement.value = `${props.spec.title(item)} put back.`
  focusHandle(item.id)
}
function onHandleBlur(item: T) {
  if (!movingFocus && lifted.value === item.id) putBack(item)
}

// --- Selecting several
const selecting = ref(false)
const selected = reactive(new Set<string>())
// Going read-only (shared from a linked main one) ends any selecting: nothing can be deleted then.
watch(
  () => readonly.value,
  (locked) => {
    if (!locked) return
    selecting.value = false
    selected.clear()
  },
)
function toggleSelecting() {
  selecting.value = !selecting.value
  selected.clear()
}
function toggle(id: string) {
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
}
const allFilteredSelected = computed(() => filtered.value.length > 0 && filtered.value.every((i) => selected.has(i.id)))
function toggleAll() {
  if (allFilteredSelected.value) filtered.value.forEach((i) => selected.delete(i.id))
  else filtered.value.forEach((i) => selected.add(i.id))
}
const bulkFields = computed(() => props.spec.fields.filter((f) => f.bulk && f.kind === 'select'))
// Toasts (an Undo, say) rise above the bulk bar instead of covering its buttons.
const root = document.documentElement.style
watchEffect(() => root.setProperty('--toast-lift', selecting.value && selected.size ? '4.5rem' : '0px'))
onBeforeUnmount(() => root.removeProperty('--toast-lift'))

const bulkSheet = useMorph()
const bulkField = ref<FieldSpec | null>(null)
function openBulk(f: FieldSpec, e: Event) {
  bulkField.value = f
  void bulkSheet.show(e)
}
async function applyBulk(value: string | null) {
  const field = bulkField.value
  void bulkSheet.hide()
  if (!field) return
  const ids = [...selected]
  const { data: updates, summary: message } = planSetFieldOn(m.state.value, props.spec.path, ids, field.key, value)
  try {
    const change = await m.writeData(updates, message)
    toast(message, { action: { label: 'Undo', run: () => m.undoChange(change) } })
    selecting.value = false
    selected.clear()
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Deleting
async function remove(ids: string[], swiped = false) {
  if (!ids.length) return
  const removal = planRemove(m.state.value, props.spec.path, ids)
  const impact = { warnings: removal.warnings }
  const what = removal.summary.slice('Deleted '.length)
  // A swipe is deliberate enough on its own: it only asks when more than the
  // item goes (results, places in the schedule…). Undo covers the rest.
  const ok =
    (swiped && !impact.warnings?.length) ||
    (await confirm({
      title: `Delete ${what}?`,
      message: [...(impact.warnings ?? []), 'You can undo this straight after.'].join(' '),
      confirmLabel: 'Delete',
      destructive: true,
    }))
  if (!ok) return
  try {
    const change = await m.writeData(removal.data, removal.summary)
    if (Object.keys(removal.lasting).length) await m.writeData(removal.lasting, null)
    if (itemId.value && ids.includes(itemId.value)) await leaveFor(listRoute.value)
    selecting.value = false
    selected.clear()
    toast(`Deleted ${what}`, { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Editing one
function saveField(item: T, key: string, value: unknown) {
  const field = [...fieldsOf(item), ...props.spec.fields].find((f) => f.key === key)?.label ?? key
  const { data: updates, summary } = planSetField(m.state.value, props.spec.path, item.id, key, value, field)
  return m.writeData(updates, summary)
}
// Bound to the item as rendered: a field saving on its way out (Back pressed
// mid-edit) must land on its own item, not whatever is open by then. If that
// item has gone (deleted on another device), the edit goes too: saving it
// would bring back a stub with only that field.
const saverFor = (item: T, f: FieldSpec) => async (v: string | null) => {
  if (!props.items.some((i) => i.id === item.id)) return
  await saveField(item, f.key, v && f.tidy ? f.tidy(v) : v)
}
// A field that tidies what's typed saves it as the line under the box says,
// once it's changed: what's saved already stays as it is until then.
const tidied = (f: FieldSpec, v: string) => (f.tidy ? f.tidy(v) : v.trim())
const noteFor = (f: FieldSpec, saved?: string | null) =>
  f.tidy ? (v: string) => (v.trim() && v.trim() !== (saved ?? '').trim() && tidied(f, v) !== v.trim() ? `Saved as ${tidied(f, v)}` : null) : undefined
const validatorFor = (item: T, f: FieldSpec) => (f.validate ? (v: string) => f.validate!(v, item.id, item as unknown as Record<string, unknown>) : undefined)
const stringValue = (item: T, key: string) => {
  const v = (item as unknown as Record<string, unknown>)[key]
  return v == null ? null : String(v)
}
const fieldValue = (item: T, key: string) => (item as unknown as Record<string, unknown>)[key] as string | number | null | undefined
// Long text (a bio, a description) is edited as plain text, even where the
// old app stored HTML. Saved as typed, the public pages show it the same way.
const textValue = (item: T, f: FieldSpec) => (f.kind === 'textarea' ? htmlToText(stringValue(item, f.key)) : fieldValue(item, f.key))
/** As read, when shared: a choice by its label. */
const shownValue = (item: T, f: FieldSpec): string | null => {
  if (f.kind !== 'select') return String(textValue(item, f) ?? '') || null
  const v = stringValue(item, f.key)
  return f.options?.().find((o) => o.value === v)?.label ?? v ?? null
}

// --- Adding
const lastAdded = ref<Record<string, string> | null>(null)
// Text fields hold strings; a list field (a team's dancers) holds its list.
const draft = reactive<Record<string, unknown>>({})
const draftErrors = reactive<Record<string, string | null>>({})
const formEl = ref<HTMLFormElement | null>(null)
const draftText = (key: string) => (typeof draft[key] === 'string' ? (draft[key] as string) : '')

// --- Optional fields: shown once they have a value, or asked for with their
// "+ Add …" button. `scope` is the item's id, or "new" for the add form.
const opened = reactive(new Set<string>())
const filledIn = (values: object, key: string) => {
  const v = (values as Record<string, unknown>)[key]
  return Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== ''
}
const isShown = (values: object, scope: string, f: FieldSpec) => !f.optional || filledIn(values, f.key) || opened.has(`${scope}:${f.key}`)
const shownFields = (values: object, scope: string) => fieldsOf(values).filter((f) => isShown(values, scope, f))
const toAdd = (values: object, scope: string) => fieldsOf(values).filter((f) => !isShown(values, scope, f))
// The dancers field's own "+ Add another dancer" joins the row of buttons.
const dancersField = shallowRef<{ addDancer: () => void; several: boolean } | null>(null)
async function openField(scope: string, key: string) {
  opened.add(`${scope}:${key}`)
  await nextTick()
  document.querySelector<HTMLElement>(`[data-field="${key}"] input, [data-field="${key}"] textarea`)?.focus()
}

function resetDraft() {
  for (const k of [...opened]) if (k.startsWith('new:')) opened.delete(k)
  const defaults = props.spec.defaults?.(lastAdded.value) ?? {}
  for (const f of props.spec.fields) {
    draft[f.key] = f.kind === 'dancers' ? [{ firstName: '', lastName: '' }] : (defaults[f.key] ?? '')
    draftErrors[f.key] = null
  }
}
watch(adding, (on) => on && resetDraft(), { immediate: true })
// A field's error goes once it's changed.
watch(
  () => ({ ...draft }),
  (now, before) => {
    for (const key of Object.keys(now)) if (now[key] !== before[key]) draftErrors[key] = null
  },
)


// A double tap on Add shouldn't add it twice.
const submitting = ref(false)
async function submitDraft(another: boolean) {
  if (submitting.value) return
  let firstError: string | null = null
  const fields = fieldsOf(draft)
  for (const f of fields) {
    if (f.kind === 'dancers') {
      draftErrors[f.key] = f.check?.(draft[f.key], { ...draft }) ?? null
      if (draftErrors[f.key] && !firstError) firstError = f.key
      continue
    }
    const v = draftText(f.key).trim()
    let err: string | null = null
    if (f.required && !v) err = `${f.label} can’t be empty.`
    else if (v && f.validate) err = f.validate(v, null, { ...draft })
    else if (v && f.kind === 'url' && !looksLikeLink(v)) err = LINK_PROBLEM
    draftErrors[f.key] = err
    if (err && !firstError) firstError = f.key
  }
  if (firstError) {
    // Centred, so its label isn't left under the top bar on a phone.
    const el = formEl.value?.querySelector<HTMLElement>(`[data-field="${firstError}"] input, [data-field="${firstError}"] select, [data-field="${firstError}"] textarea`)
    el?.focus({ preventScroll: true })
    el?.scrollIntoView({ block: 'center' })
    return
  }
  const id = m.newKey()
  // (Each typed field tidied as the line under its box said.)
  const typed = Object.fromEntries(fields.filter((f) => typeof draft[f.key] === 'string').map((f) => [f.key, tidied(f, draftText(f.key))]))
  const record: Record<string, unknown> = props.spec.toRecord
    ? props.spec.toRecord({ ...draft, ...typed })
    : Object.fromEntries(Object.entries(typed).filter(([, v]) => v))
  const { data: updates, summary } = planAdd(m.state.value, props.spec.path, id, record, typed)
  const saved = updates[`${props.spec.path}/${id}`] as Record<string, unknown>
  submitting.value = true
  try {
    await m.writeData(updates, summary)
    lastAdded.value = Object.fromEntries(Object.entries(saved).filter(([, v]) => typeof v !== 'object').map(([k, v]) => [k, String(v)]))
    if (another) {
      toast(summary)
      resetDraft()
      await nextTick()
      formEl.value?.querySelector<HTMLElement>('input, select, textarea')?.focus()
    } else {
      toast(summary)
      await leaveFor(itemRoute(id))
    }
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    submitting.value = false
  }
}

// --- Presets
const presetsSheet = useMorph()
const presetPicks = reactive(new Set<number>())
const existingTitles = computed(() => new Set(props.items.map((i) => props.spec.title(i).trim().toLowerCase())))
// Chosen once for every preset added (an age group's category), never guessed.
const scopeField = computed(() => props.spec.fields.find((f) => f.key === props.spec.presetsScope) ?? null)
const scopeOptions = computed(() => scopeField.value?.options?.() ?? [])
const presetScope = ref('')
const same = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
function presetTaken(index: number) {
  const p = props.spec.presets?.[index]
  if (!p) return false
  if (!scopeField.value) return existingTitles.value.has(p.label.trim().toLowerCase())
  const scope = scopeField.value.key
  return (
    !!presetScope.value &&
    props.items.some((i) => stringValue(i, scope) === presetScope.value && Object.entries(p.values).every(([k, v]) => same(stringValue(i, k), v)))
  )
}
// Once added, a second tap while the sheet closes adds nothing more.
let presetsTaken = false
function openPresets(e: Event) {
  presetPicks.clear()
  presetsTaken = false
  // The last choice stays (shown at the top); only one option is a choice already made.
  const options = scopeOptions.value
  if (!options.some((o) => o.value === presetScope.value)) presetScope.value = options.length === 1 ? options[0].value : ''
  void presetsSheet.show(e)
}
// Ones already in the newly chosen category can't stay ticked.
watch(presetScope, () => {
  for (const i of [...presetPicks]) if (presetTaken(i)) presetPicks.delete(i)
})
async function addPresets() {
  const presets = props.spec.presets ?? []
  const picks = [...presetPicks].sort((a, b) => a - b)
  void presetsSheet.hide()
  if (!picks.length || presetsTaken || (scopeField.value && !presetScope.value)) return
  presetsTaken = true
  const scope = scopeField.value ? { [scopeField.value.key]: presetScope.value } : {}
  const { data: updates, summary: message } = planAddPresets(m.state.value, props.spec.path, picks.map((i) => presets[i].values), scope, m.newKey)
  try {
    const change = await m.writeData(updates, message)
    toast(message, { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// Named as in the sidebar (Staff), else after what's listed.
const section = computed(() => ALL_SECTIONS.find((s) => s.route === props.spec.route))
const title = computed(() => section.value?.title ?? props.spec.plural[0].toUpperCase() + props.spec.plural.slice(1))
const countLabel = computed(() => {
  const n = props.items.length
  if (query.value.trim()) return `${filtered.value.length} of ${n}`
  return String(n)
})
const icon = computed(() => section.value?.icon ?? Plus)

// Ways to add. Empty, the usual start (importing the dancers, the common
// ones, or Import) is the main button; once there's a list, adding one more
// is what's usual, so Add takes the tint.
const hasStart = computed(() => !!props.spec.importFirst || !!props.spec.presets?.length || !!slots['list-actions'])
</script>

<template>
  <!-- With nothing in it yet, one column: no blank pane beside an empty list. -->
  <MasterDetail :show-detail="showDetail" :single="!items.length && !showDetail">
    <template #list>
      <div class="paper sticky top-(--chrome-top) z-10 p-4 md:top-0">
        <SectionHeader :title="title" :count="items.length ? countLabel : null">
          <template v-if="items.length && !readonly" #actions>
            <Button variant="plain" class="-mr-3" :aria-pressed="selecting" @click="toggleSelecting">
              {{ selecting ? 'Done' : 'Select' }}
            </Button>
          </template>
          <!-- Shared: a lock where Add would be; tapping says why. -->
          <template v-else-if="shared" #actions>
            <button
              type="button"
              class="press bg-muted text-muted-foreground -my-1 flex size-11 items-center justify-center rounded-full"
              :aria-label="`Why ${spec.plural} can’t be added here`"
              @click="sheet?.explain(shared, $event)"
            >
              <Lock class="size-4" />
            </button>
          </template>
          <!-- Ways to add, the same on every tab: the usual start first (the
               common ones, or Import), then one at a time. While selecting,
               Select all takes their place, so nothing below moves. -->
          <div v-if="items.length && !selecting && !readonly" class="flex flex-wrap gap-2">
            <Button v-if="spec.presets?.length" :disabled="!canEdit" @click="openPresets">
              <ListPlus /> Add common {{ spec.plural }}
            </Button>
            <slot name="list-actions" variant="secondary" />
            <Button variant="tonal" :to="itemRoute('new')" :replace="split" :aria-label="`Add ${spec.singular}`" :disabled="!canEdit">
              <Plus /> Add
            </Button>
          </div>
          <div v-else-if="selecting" class="flex items-center gap-2">
            <Button variant="plain" class="-ml-4" @click="toggleAll">
              <Checkbox :checked="allFilteredSelected" />
              <span class="ml-1">{{ allFilteredSelected ? 'Select none' : query ? 'Select all shown' : 'Select all' }}</span>
            </Button>
            <span class="text-muted-foreground ml-auto text-sm font-medium tabular-nums">{{ selected.size }} selected</span>
          </div>
          <SearchField v-if="items.length > 6" v-model="query" :label="`Search ${spec.plural}`" />
        </SectionHeader>
      </div>

      <slot name="notice" />
      <slot v-if="items.length" name="list-intro" />

      <!-- Empty: what it's for, and the ways to add some -->
      <EmptyState v-if="!items.length" :icon="icon" :title="`No ${spec.plural} yet`" :description="readonly ? undefined : spec.emptyHint">
        <template v-if="!readonly">
        <Button v-if="spec.importFirst" variant="primary" :to="importRoute" :disabled="!canEdit">
          <FileSpreadsheet /> Import dancers
        </Button>
        <Button v-if="spec.presets?.length" :variant="spec.importFirst ? 'secondary' : 'primary'" :disabled="!canEdit" @click="openPresets">
          <ListPlus /> Add common {{ spec.plural }}
        </Button>
        <slot name="list-actions" variant="primary" />
        <Button :variant="!hasStart ? 'primary' : spec.importFirst ? 'plain' : 'secondary'" :to="itemRoute('new')" :replace="split" :disabled="!canEdit">
          <Plus /> Add {{ spec.singular }}
        </Button>
        </template>
      </EmptyState>
      <p v-else-if="!filtered.length" class="text-muted-foreground px-4 py-10 text-center text-base">
        Nothing matches “{{ query }}”.
      </p>

      <!-- Rows open the item (or, while selecting, tick it); swipe one left
           to delete it; drag, or move from the keyboard, by the grip. -->
      <VueDraggable
        v-else
        v-model="order"
        target=".sort-target"
        handle="[data-handle]"
        :disabled="!canReorder"
        :animation="150"
        ghost-class="opacity-40"
        @start="dragging = true"
        @end="onDragEnd"
      >
        <MovingList :still="dragging || hushed" :class="['sort-target rows-engraved [--inset-end:1rem]', listInset, selecting && selected.size && 'pb-24']">
          <li v-for="item in canReorder ? order : filtered" :key="item.id">
            <!-- The row's tint and focus ring take in the grip too. -->
            <SwipeRow
              :disabled="!canEdit || selecting || readonly"
              :remove="() => remove([item.id], true)"
              :class="[
                'has-focus-visible:outline-ring flex items-stretch has-focus-visible:outline-3 has-focus-visible:-outline-offset-3',
                lifted === item.id
                  ? 'surface-raised z-1'
                  : ['press-row', itemId === item.id || (selecting && selected.has(item.id)) ? 'bg-blue-paper' : ''],
              ]"
            >
              <!-- The leading edge: a grip where the list can be reordered, else a margin. -->
              <span :class="['flex shrink-0 overflow-hidden transition-[width] duration-(--dur-base) ease-standard', canReorder ? 'w-10' : 'w-4']">
                <button
                  v-if="canReorder"
                  type="button"
                  data-handle
                  :data-handle-for="item.id"
                  :aria-label="`Move ${spec.title(item)}`"
                  :aria-pressed="lifted === item.id"
                  class="text-muted-foreground flex w-10 shrink-0 cursor-grab touch-none items-center justify-center focus-visible:outline-none active:cursor-grabbing"
                  @keydown="onHandleKey($event, item)"
                  @blur="onHandleBlur(item)"
                >
                  <GripVertical class="size-5" />
                </button>
              </span>
              <!-- Selecting: a tick box grows in where the grip was. -->
              <span
                aria-hidden="true"
                :class="[
                  'flex shrink-0 items-center overflow-hidden transition-[width,opacity] duration-(--dur-base) ease-standard',
                  selecting ? 'w-[2.125rem] opacity-100' : 'w-0 opacity-0',
                ]"
              >
                <Checkbox :checked="selected.has(item.id)" />
              </span>
              <component
                :is="selecting ? 'button' : RouterLink"
                v-bind="
                  selecting
                    ? { type: 'button', role: 'checkbox', 'aria-checked': selected.has(item.id), onClick: () => toggle(item.id) }
                    : { to: itemRoute(item.id), replace: split, 'aria-current': itemId === item.id ? 'true' : undefined }
                "
                :class="[
                  'flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-3 text-left focus-visible:outline-none',
                  // The whole row is the tick box's target.
                  selecting && 'after:absolute after:inset-0',
                ]"
              >
                <NumberTile v-if="spec.badge" :num="spec.badge(item)" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-medium">{{ spec.title(item) }}</span>
                  <span v-if="spec.subtitle?.(item)" class="text-muted-foreground block truncate text-sm">{{ spec.subtitle(item) }}</span>
                </span>
                <ChevronRight v-if="!selecting" class="text-muted-foreground size-5 shrink-0 md:hidden" />
              </component>
            </SwipeRow>
          </li>
        </MovingList>
      </VueDraggable>
      <p class="sr-only" aria-live="assertive">{{ announcement }}</p>

      <!-- Bulk actions: up from the bottom once something's chosen -->
      <Transition
        enter-active-class="transition-[translate,opacity] duration-(--dur-slow) ease-snappy motion-reduce:transition-opacity"
        enter-from-class="translate-y-[calc(100%+1.5rem)] opacity-0 motion-reduce:translate-y-0"
        leave-active-class="transition-[translate,opacity] duration-(--dur-quick) ease-exit"
        leave-to-class="translate-y-[calc(100%+1.5rem)] opacity-0 motion-reduce:translate-y-0"
      >
        <div
          v-if="selecting && selected.size && !readonly"
          class="glass fixed inset-x-chrome-3 bottom-[calc(var(--safe-bottom)+0.75rem)] z-20 flex flex-wrap items-center gap-2 rounded-2xl p-2 md:sticky md:inset-x-auto md:bottom-3 md:mx-3"
        >
          <Button v-for="f in bulkFields" :key="f.key" :disabled="!canEdit" @click="openBulk(f, $event)">
            Set {{ f.label.toLowerCase() }}
          </Button>
          <Button variant="destructive" class="ml-auto" :disabled="!canEdit" @click="remove([...selected])">
            <Trash2 /> Delete {{ selected.size }}
          </Button>
        </div>
      </Transition>
    </template>

    <template #empty>
      <div class="hidden h-full items-center justify-center md:flex">
        <EmptyState
          v-if="items.length"
          :icon="icon"
          :title="`Choose ${spec.singular.match(/^[aeiou]/i) ? 'an' : 'a'} ${spec.singular}`"
          description="See and change its details here."
        />
      </div>
    </template>

    <template #detail>
      <!-- Adding -->
      <form v-if="adding && !readonly" ref="formEl" class="mx-auto max-w-2xl space-y-6 p-4 md:p-8" novalidate @submit.prevent="submitDraft(false)">
        <h2 class="text-display">Add {{ singularOf(draft) }}</h2>
        <div class="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <div
            v-for="f in shownFields(draft, 'new').filter((f) => f.kind !== 'image')"
            :key="f.key"
            :data-field="f.key"
            :class="f.half ? 'sm:col-span-1' : 'sm:col-span-2'"
          >
            <DancersField
              v-if="f.kind === 'dancers'"
              :ref="(el) => (dancersField = el as never)"
              :model-value="(draft[f.key] as never) ?? []"
              :error="draftErrors[f.key]"
              @update:model-value="(v) => (draft[f.key] = v)"
            />
            <FormInput
              v-else
              :model-value="draftText(f.key)"
              :label="f.label"
              :kind="f.kind === 'select' ? 'select' : f.kind === 'textarea' ? 'textarea' : f.kind === 'url' ? 'url' : 'text'"
              :options="f.options?.()"
              :hint="noteFor(f)?.(draftText(f.key)) || f.hint"
              :error="draftErrors[f.key]"
              :required="f.required"
              :placeholder="f.placeholder"
              :inputmode="f.inputmode"
              @update:model-value="(v: string) => (draft[f.key] = v)"
            />
          </div>
        </div>
        <div v-if="toAdd(draft, 'new').length || (dancersField && !dancersField.several)" class="flex flex-wrap gap-2">
          <Button v-if="dancersField && !dancersField.several" :disabled="!canEdit" @click="dancersField.addDancer()"><Plus /> Add another dancer</Button>
          <Button v-for="f in toAdd(draft, 'new')" :key="f.key" :disabled="!canEdit" @click="openField('new', f.key)"><Plus /> Add {{ f.addLabel ?? f.label.toLowerCase() }}</Button>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="primary" size="lg" :disabled="!canEdit" :busy="submitting">
            Add {{ singularOf(draft) }}
          </Button>
          <Button size="lg" :disabled="!canEdit || submitting" @click="submitDraft(true)">
            Add and add another
          </Button>
        </div>
      </form>

      <!-- Editing -->
      <div v-else-if="current" :key="current.id" class="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
        <header class="flex items-center gap-3">
          <!-- A dancer's number at this competition, as the card they'll wear. -->
          <NumberCard v-if="spec.badge?.(current)" :number="spec.badge(current)" size="md" />
          <div class="min-w-0">
            <h2 class="text-display break-words">{{ spec.title(current) }}</h2>
            <p v-if="(spec.detailSubtitle ?? spec.subtitle)?.(current)" class="text-muted-foreground text-base">{{ (spec.detailSubtitle ?? spec.subtitle)!(current) }}</p>
          </div>
        </header>
        <div class="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <div v-for="f in shownFields(current, current.id)" :key="f.key" :data-field="f.key" :class="f.half ? 'sm:col-span-1' : 'sm:col-span-2'">
            <template v-if="shared">
              <SharedValue v-if="f.kind === 'image'" :label="f.label" :part="shared">
                <img v-if="stringValue(current, f.key)" :src="stringValue(current, f.key)!" alt="" class="size-16 rounded-full object-cover" />
                <span v-else class="text-muted-foreground">Nothing yet</span>
              </SharedValue>
              <SharedValue v-else :label="f.label" :part="shared" :value="shownValue(current, f)" :multiline="f.kind === 'textarea'" />
            </template>
            <DancersField v-else-if="f.kind === 'dancers'" :ref="(el) => (dancersField = el as never)" :item="current as never" />
            <SelectField
              v-else-if="f.kind === 'select'"
              :model-value="stringValue(current, f.key)"
              :label="f.label"
              :options="f.options?.() ?? []"
              :hint="f.hint"
              :required="f.required"
              :placeholder="f.placeholder"
              :save="saverFor(current, f)"
            />
            <ImageField
              v-else-if="f.kind === 'image'"
              :model-value="stringValue(current, f.key)"
              :label="f.label"
              :hint="f.hint"
              :folder="f.storage ?? 'staff'"
              :competition-id="m.competitionId.value"
              shape="round"
              :save="saverFor(current, f)"
            />
            <TextField
              v-else
              :model-value="textValue(current, f)"
              :label="f.label"
              :hint="f.hint"
              :required="f.required"
              :placeholder="f.placeholder"
              :multiline="f.kind === 'textarea'"
              :type="f.kind === 'url' ? 'url' : 'text'"
              :inputmode="f.inputmode"
              :validate="validatorFor(current, f)"
              :note="noteFor(f, stringValue(current, f.key))"
              :save="saverFor(current, f)"
            />
          </div>
        </div>
        <div v-if="!readonly && !shared && (toAdd(current, current.id).length || (dancersField && !dancersField.several))" class="flex flex-wrap gap-2">
          <Button v-if="dancersField && !dancersField.several" :disabled="!canEdit" @click="dancersField.addDancer()"><Plus /> Add another dancer</Button>
          <Button v-for="f in toAdd(current, current.id)" :key="f.key" :disabled="!canEdit" @click="openField(current.id, f.key)"><Plus /> Add {{ f.addLabel ?? f.label.toLowerCase() }}</Button>
        </div>
        <slot name="detail-extra" :item="current" />
        <footer v-if="!readonly" class="engraved-line pt-6">
          <Button variant="plain" class="text-destructive! -ml-4" :disabled="!canEdit" @click="remove([current.id])">
            <Trash2 /> Delete {{ singularOf(current) }}
          </Button>
        </footer>
      </div>

      <!-- Gone (deleted elsewhere, or an old link) -->
      <EmptyState v-else :icon="X" :title="`This ${spec.singular} isn’t here any more`" description="It may have been deleted. Choose another from the list." />
    </template>
  </MasterDetail>

  <!-- Why a shared one can't be changed here (outside the panes: a phone hides the list while one's open) -->
  <SharedSheet v-if="shared" />

  <!-- Presets -->
  <Dialog :open="presetsSheet.open" :morph="presetsSheet" variant="sheet" size="md" @close="presetsSheet.hide()">
    <template #header>
      <h2 class="text-title">Add common {{ spec.plural }}</h2>
      <p class="text-muted-foreground text-sm">{{ spec.presetsLead ?? 'The usual ones. Rename them any time.' }}</p>
    </template>
    <div v-if="scopeField" class="border-b p-4">
      <FormInput
        v-model="presetScope"
        :label="scopeField.label"
        kind="select"
        :options="scopeOptions"
        :hint="scopeField.hint"
        :placeholder="scopeField.placeholder"
        required
      />
    </div>
    <ul class="divide-y">
      <li v-for="(p, i) in spec.presets" :key="i">
        <button
          type="button"
          role="checkbox"
          :aria-checked="presetPicks.has(i)"
          :disabled="presetTaken(i)"
          class="press-row focus-inset flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-(--disabled-opacity)"
          @click="presetPicks.has(i) ? presetPicks.delete(i) : presetPicks.add(i)"
        >
          <Checkbox :checked="presetPicks.has(i) || presetTaken(i)" />
          <span class="min-w-0 flex-1 text-base font-medium">{{ p.label }}</span>
          <span v-if="presetTaken(i)" class="text-muted-foreground text-sm">Added</span>
        </button>
      </li>
    </ul>
    <div class="bg-card sticky bottom-0 border-t p-4 pb-[calc(1rem+var(--safe-bottom))]">
      <Button variant="primary" size="lg" block :disabled="!presetPicks.size || (!!scopeField && !presetScope)" @click="addPresets">
        {{
          scopeField && !presetScope
            ? `Choose ${/^[aeiou]/i.test(scopeField.label) ? 'an' : 'a'} ${scopeField.label.toLowerCase()} first`
            : presetPicks.size
              ? `Add ${presetPicks.size}`
              : 'Choose some to add'
        }}
      </Button>
    </div>
  </Dialog>

  <!-- Bulk "Set …" -->
  <Dialog :open="bulkSheet.open" :morph="bulkSheet" variant="sheet" @close="bulkSheet.hide()">
    <template #header>
      <h2 class="text-title">Set {{ bulkField?.label.toLowerCase() }}</h2>
      <p class="text-muted-foreground text-sm">For {{ selected.size }} {{ selected.size === 1 ? spec.singular : spec.plural }}</p>
    </template>
    <ul class="divide-y pb-[var(--safe-bottom)]">
      <li v-if="!bulkField?.required">
        <button type="button" class="press-row focus-inset flex min-h-13 w-full items-center px-4 text-left text-base font-medium" @click="applyBulk(null)">None</button>
      </li>
      <li v-for="o in bulkField?.options?.() ?? []" :key="o.value">
        <button type="button" class="press-row focus-inset flex min-h-13 w-full items-center px-4 py-2 text-left text-base font-medium" @click="applyBulk(o.value)">
          {{ o.label }}
        </button>
      </li>
    </ul>
  </Dialog>
</template>
