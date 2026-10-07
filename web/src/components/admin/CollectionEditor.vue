<script setup lang="ts" generic="T extends CollectionItem">
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { ChevronRight, FileSpreadsheet, GripVertical, ListPlus, Plus, Trash2, X } from '@lucide/vue'
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
import FormInput from '@/components/admin/FormInput.vue'
import NumberTile from '@/components/admin/NumberTile.vue'
import NumberCard from '@/components/NumberCard.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSplit } from '@/composables/admin/useWide'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { LINK_PROBLEM, looksLikeLink, type CollectionItem, type CollectionSpec, type FieldSpec } from '@/lib/admin/collection'
import { htmlToText } from '@/lib/admin/richText'
import { ALL_SECTIONS } from '@/lib/admin/sections'
import { useMorph } from '@/lib/morph'

// One editable list: search, select several to change or delete at once,
// drag to reorder (or move from the keyboard), swipe one left to delete it,
// add one (or many, from presets or one after another), and edit the chosen
// item beside the list. Every change saves straight away; deletes can be
// undone from the toast.

const props = defineProps<{
  spec: CollectionSpec<T>
  items: T[]
}>()

const slots = defineSlots<{
  /** More ways to add (Import…), as a Button of the given variant to sit with the others. */
  'list-actions'?: (p: { variant: 'primary' | 'secondary' }) => unknown
  'detail-extra'?: (p: { item: T }) => unknown
  'list-intro'?: () => unknown
}>()

const route = useRoute()
const router = useRouter()
const m = useManagedCompetition()
const split = useSplit()

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
const canReorder = computed(() => !!props.spec.sortable && !query.value.trim() && !selecting.value && canEdit.value)

async function saveOrder() {
  const updates: Record<string, unknown> = {}
  order.value.forEach((item, index) => {
    if (item._order !== index) updates[`${props.spec.path}/${item.id}/_order`] = index
  })
  // Dropped where it started: nothing to save (or to undo).
  if (!Object.keys(updates).length) return
  try {
    await m.writeData(updates, `Reordered ${props.spec.plural}`)
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
  const updates: Record<string, unknown> = {}
  for (const id of ids) {
    updates[`${props.spec.path}/${id}/${field.key}`] = value
    const item = props.items.find((i) => i.id === id)
    if (item && props.spec.onChange) Object.assign(updates, props.spec.onChange(item, field.key, value))
  }
  try {
    const message = `Updated ${ids.length} ${ids.length === 1 ? props.spec.singular : props.spec.plural}`
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
  const names = ids.map((id) => props.items.find((i) => i.id === id)).filter(Boolean).map((i) => props.spec.title(i as T))
  const impact = props.spec.impact?.(ids) ?? {}
  const what = ids.length === 1 ? (names[0] ?? `this ${props.spec.singular}`) : `${ids.length} ${props.spec.plural}`
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
  const updates: Record<string, unknown> = { ...impact.updates }
  for (const id of ids) updates[`${props.spec.path}/${id}`] = null
  try {
    const change = await m.writeData(updates, `Deleted ${what}`)
    if (itemId.value && ids.includes(itemId.value)) await leaveFor(listRoute.value)
    selecting.value = false
    selected.clear()
    toast(`Deleted ${what}`, { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Editing one
function saveField(item: T, key: string, value: string | null) {
  const updates: Record<string, unknown> = { [`${props.spec.path}/${item.id}/${key}`]: value }
  if (props.spec.onChange) Object.assign(updates, props.spec.onChange(item, key, value))
  const field = props.spec.fields.find((f) => f.key === key)?.label ?? key
  return m.writeData(updates, `${field} of ${props.spec.title(item) || `the ${props.spec.singular}`}`)
}
// Bound to the item as rendered: a field saving on its way out (Back pressed
// mid-edit) must land on its own item, not whatever is open by then. If that
// item has gone (deleted on another device), the edit goes too: saving it
// would bring back a stub with only that field.
const saverFor = (item: T, key: string) => async (v: string | null) => {
  if (!props.items.some((i) => i.id === item.id)) return
  await saveField(item, key, v)
}
const validatorFor = (item: T, f: FieldSpec) => (f.validate ? (v: string) => f.validate!(v, item.id, item as unknown as Record<string, unknown>) : undefined)
const stringValue = (item: T, key: string) => {
  const v = (item as unknown as Record<string, unknown>)[key]
  return v == null ? null : String(v)
}
const fieldValue = (item: T, key: string) => (item as unknown as Record<string, unknown>)[key] as string | number | null | undefined
// Long text (a bio, a description) is edited as plain text, even where the
// old app stored HTML. Saved as typed, the public pages show it the same way.
const textValue = (item: T, f: FieldSpec) => (f.kind === 'textarea' ? htmlToText(stringValue(item, f.key)) : fieldValue(item, f.key))

// --- Adding
const lastAdded = ref<Record<string, string> | null>(null)
const draft = reactive<Record<string, string>>({})
const draftErrors = reactive<Record<string, string | null>>({})
const formEl = ref<HTMLFormElement | null>(null)

function resetDraft() {
  const defaults = props.spec.defaults?.(lastAdded.value) ?? {}
  for (const f of props.spec.fields) {
    draft[f.key] = defaults[f.key] ?? ''
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

const nextOrder = () => props.items.reduce((max, i) => Math.max(max, typeof i._order === 'number' ? i._order : -1), -1) + 1

// A double tap on Add shouldn't add it twice.
const submitting = ref(false)
async function submitDraft(another: boolean) {
  if (submitting.value) return
  let firstError: string | null = null
  for (const f of props.spec.fields) {
    const v = (draft[f.key] ?? '').trim()
    let err: string | null = null
    if (f.required && !v) err = `${f.label} can’t be empty.`
    else if (v && f.validate) err = f.validate(v, null, draft)
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
  const record: Record<string, unknown> = {}
  for (const f of props.spec.fields) {
    const v = (draft[f.key] ?? '').trim()
    if (v) record[f.key] = v
  }
  if (props.spec.sortable) record._order = nextOrder()
  // Extra fields that follow from others (e.g. a dancer's category) go into
  // the new record itself: one write can't touch a path and its child.
  const updates: Record<string, unknown> = {}
  const own = `${props.spec.path}/${id}/`
  if (props.spec.onChange) {
    for (const f of props.spec.fields) {
      const v = (draft[f.key] ?? '').trim()
      if (!v) continue
      for (const [path, value] of Object.entries(props.spec.onChange({ ...(record as object), id, label: '' } as unknown as T, f.key, v))) {
        if (path.startsWith(own)) {
          if (value != null) record[path.slice(own.length)] = value
        } else updates[path] = value
      }
    }
  }
  updates[`${props.spec.path}/${id}`] = record
  const recordLabel = String(record.name ?? [record.firstName, record.lastName].filter(Boolean).join(' '))
  const name = props.spec.title({ ...(record as object), id, label: recordLabel } as unknown as T) || recordLabel || `the ${props.spec.singular}`
  submitting.value = true
  try {
    await m.writeData(updates, `Added ${name}`)
    lastAdded.value = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, String(v)]))
    if (another) {
      toast(`Added ${name}`)
      resetDraft()
      await nextTick()
      formEl.value?.querySelector<HTMLElement>('input, select, textarea')?.focus()
    } else {
      toast(`Added ${name}`)
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
function presetTaken(index: number) {
  const p = props.spec.presets?.[index]
  return !!p && existingTitles.value.has(p.label.trim().toLowerCase())
}
// Once added, a second tap while the sheet closes adds nothing more.
let presetsTaken = false
function openPresets(e: Event) {
  presetPicks.clear()
  presetsTaken = false
  void presetsSheet.show(e)
}
async function addPresets() {
  const presets = props.spec.presets ?? []
  const picks = [...presetPicks].sort((a, b) => a - b)
  void presetsSheet.hide()
  if (!picks.length || presetsTaken) return
  presetsTaken = true
  let order = nextOrder()
  const updates: Record<string, unknown> = {}
  for (const i of picks) {
    updates[`${props.spec.path}/${m.newKey()}`] = { ...presets[i].values, ...(props.spec.sortable ? { _order: order++ } : {}) }
  }
  try {
    const message = `Added ${picks.length} ${picks.length === 1 ? props.spec.singular : props.spec.plural}`
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
      <div class="bg-background sticky top-(--chrome-top) z-10 border-b p-4 md:top-0">
        <SectionHeader :title="title" :count="items.length ? countLabel : null">
          <template v-if="items.length" #actions>
            <Button variant="plain" class="-mr-3" :aria-pressed="selecting" @click="toggleSelecting">
              {{ selecting ? 'Done' : 'Select' }}
            </Button>
          </template>
          <!-- Ways to add, the same on every tab: the usual start first (the
               common ones, or Import), then one at a time. While selecting,
               Select all takes their place, so nothing below moves. -->
          <div v-if="items.length && !selecting" class="flex flex-wrap gap-2">
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

      <slot v-if="items.length" name="list-intro" />

      <!-- Empty: what it's for, and the ways to add some -->
      <EmptyState v-if="!items.length" :icon="icon" :title="`No ${spec.plural} yet`" :description="spec.emptyHint">
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
        <MovingList :still="dragging || hushed" :class="['sort-target divide-y', selecting && selected.size && 'pb-24']">
          <li v-for="item in canReorder ? order : filtered" :key="item.id">
            <!-- The row's tint and focus ring take in the grip too. -->
            <SwipeRow
              :disabled="!canEdit || selecting"
              :remove="() => remove([item.id], true)"
              :class="[
                'has-focus-visible:outline-ring flex items-stretch has-focus-visible:outline-3 has-focus-visible:-outline-offset-3',
                lifted === item.id
                  ? 'surface-raised z-1'
                  : ['press-row', itemId === item.id || (selecting && selected.has(item.id)) ? 'bg-blue-paper' : 'bg-background'],
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
          v-if="selecting && selected.size"
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
      <form v-if="adding" ref="formEl" class="mx-auto max-w-2xl space-y-6 p-4 md:p-8" novalidate @submit.prevent="submitDraft(false)">
        <h2 class="text-display">Add {{ spec.singular }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="f in spec.fields.filter((f) => f.kind !== 'image')"
            :key="f.key"
            :data-field="f.key"
            :class="f.half ? 'sm:col-span-1' : 'sm:col-span-2'"
          >
            <FormInput
              v-model="draft[f.key]"
              :label="f.label"
              :kind="f.kind === 'select' ? 'select' : f.kind === 'textarea' ? 'textarea' : f.kind === 'url' ? 'url' : 'text'"
              :options="f.options?.()"
              :hint="f.hint"
              :error="draftErrors[f.key]"
              :required="f.required"
              :placeholder="f.placeholder"
              :inputmode="f.inputmode"
            />
          </div>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="primary" size="lg" :disabled="!canEdit" :busy="submitting">
            Add {{ spec.singular }}
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
            <p v-if="spec.subtitle?.(current)" class="text-muted-foreground text-base">{{ spec.subtitle(current) }}</p>
          </div>
        </header>
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="f in spec.fields" :key="f.key" :class="f.half ? 'sm:col-span-1' : 'sm:col-span-2'">
            <SelectField
              v-if="f.kind === 'select'"
              :model-value="stringValue(current, f.key)"
              :label="f.label"
              :options="f.options?.() ?? []"
              :hint="f.hint"
              :required="f.required"
              :placeholder="f.placeholder"
              :save="saverFor(current, f.key)"
            />
            <ImageField
              v-else-if="f.kind === 'image'"
              :model-value="stringValue(current, f.key)"
              :label="f.label"
              :hint="f.hint"
              :folder="f.storage ?? 'staff'"
              :competition-id="m.competitionId.value"
              shape="round"
              :save="saverFor(current, f.key)"
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
              :save="saverFor(current, f.key)"
            />
          </div>
        </div>
        <slot name="detail-extra" :item="current" />
        <footer class="border-t pt-6">
          <Button variant="plain" class="text-destructive! -ml-4" :disabled="!canEdit" @click="remove([current.id])">
            <Trash2 /> Delete {{ spec.singular }}
          </Button>
        </footer>
      </div>

      <!-- Gone (deleted elsewhere, or an old link) -->
      <EmptyState v-else :icon="X" :title="`This ${spec.singular} isn’t here any more`" description="It may have been deleted. Choose another from the list." />
    </template>
  </MasterDetail>

  <!-- Presets -->
  <Dialog :open="presetsSheet.open" :morph="presetsSheet" variant="sheet" size="md" @close="presetsSheet.hide()">
    <template #header>
      <h2 class="text-title">Add common {{ spec.plural }}</h2>
      <p class="text-muted-foreground text-sm">{{ spec.presetsLead ?? 'The usual ones. Rename them any time.' }}</p>
    </template>
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
      <Button variant="primary" size="lg" block :disabled="!presetPicks.size" @click="addPresets">
        {{ presetPicks.size ? `Add ${presetPicks.size}` : 'Choose some to add' }}
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
