<script setup lang="ts" generic="T extends CollectionItem">
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import {
  Check,
  CheckSquare,
  ChevronRight,
  GripVertical,
  ListPlus,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import SwipeRow from '@/components/admin/SwipeRow.vue'
import TextField from '@/components/admin/TextField.vue'
import SelectField from '@/components/admin/SelectField.vue'
import ImageField from '@/components/admin/ImageField.vue'
import FormInput from '@/components/admin/FormInput.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSplit } from '@/composables/admin/useWide'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { LINK_PROBLEM, looksLikeLink, type CollectionItem, type CollectionSpec, type FieldSpec } from '@/lib/admin/collection'
import { ALL_SECTIONS } from '@/lib/admin/sections'

// One editable list: search, select several to change or delete at once,
// drag to reorder, swipe one left to delete it, add one (or many, from
// presets or one after another), and edit the chosen item beside the list.
// Every change saves straight away; deletes can be undone from the toast.

const props = defineProps<{
  spec: CollectionSpec<T>
  items: T[]
}>()

const slots = defineSlots<{
  /** More ways to add (Import…), styled with `cls` to sit with the others. */
  'list-actions'?: (p: { cls: string }) => unknown
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

// --- Reordering (only while not searching or selecting)
const order = shallowRef<T[]>([])
const dragging = ref(false)
watch(
  () => props.items,
  (items) => {
    if (!dragging.value) order.value = [...items]
  },
  { immediate: true },
)
const canReorder = computed(() => !!props.spec.sortable && !query.value.trim() && !selecting.value && canEdit.value)

async function onDragEnd() {
  dragging.value = false
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

const bulkField = ref<FieldSpec | null>(null)
async function applyBulk(value: string | null) {
  const field = bulkField.value
  bulkField.value = null
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
const presetsOpen = ref(false)
const presetPicks = reactive(new Set<number>())
const existingTitles = computed(() => new Set(props.items.map((i) => props.spec.title(i).trim().toLowerCase())))
function presetTaken(index: number) {
  const p = props.spec.presets?.[index]
  return !!p && existingTitles.value.has(p.label.trim().toLowerCase())
}
function openPresets() {
  presetPicks.clear()
  presetsOpen.value = true
}
async function addPresets() {
  const presets = props.spec.presets ?? []
  const picks = [...presetPicks].sort((a, b) => a - b)
  presetsOpen.value = false
  if (!picks.length) return
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

// Ways to add. Where there's a usual start (the common ones, or Import),
// that's the main button and adding one at a time sits beside it.
const hasStart = computed(() => !!props.spec.presets?.length || !!slots['list-actions'])
const PRIMARY = 'bg-primary-fill text-primary-foreground flex h-11 items-center gap-1.5 rounded-xl px-4 text-[0.9375rem] font-bold disabled:opacity-50'
const SECONDARY = 'bg-card border-strong hover:bg-accent flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.9375rem] font-bold disabled:opacity-50'
</script>

<template>
  <MasterDetail :show-detail="showDetail">
    <template #list>
      <div class="bg-background sticky top-(--chrome-top) z-10 border-b p-4 md:top-0">
        <SectionHeader :title="title" :count="items.length ? countLabel : null">
          <template v-if="items.length" #actions>
            <button
              type="button"
              :aria-pressed="selecting"
              :class="[
                'h-11 rounded-xl px-3 text-[0.9375rem] font-bold',
                selecting ? 'bg-primary-fill text-primary-foreground' : 'text-primary hover:bg-accent',
              ]"
              @click="toggleSelecting"
            >
              {{ selecting ? 'Done' : 'Select' }}
            </button>
          </template>
          <!-- Ways to add, the same on every tab: the usual start first (the
               common ones, or Import), then one at a time. While selecting,
               Select all takes their place, so nothing below moves. -->
          <div v-if="items.length && !selecting" class="flex flex-wrap gap-2">
            <button v-if="spec.presets?.length" type="button" :disabled="!canEdit" :class="PRIMARY" @click="openPresets">
              <ListPlus class="size-4" /> Add common {{ spec.plural }}
            </button>
            <slot name="list-actions" :cls="PRIMARY" />
            <RouterLink
              :to="itemRoute('new')"
              :replace="split"
              :aria-label="`Add ${spec.singular}`"
              :class="[hasStart ? SECONDARY : PRIMARY, !canEdit && 'pointer-events-none opacity-50']"
            >
              <Plus class="size-4" /> Add
            </RouterLink>
          </div>
          <div v-else-if="selecting" class="flex items-center gap-2">
            <button type="button" class="text-primary hover:bg-accent -ml-2 flex h-11 items-center gap-2 rounded-xl px-2 text-[0.9375rem] font-bold" @click="toggleAll">
              <component :is="allFilteredSelected ? CheckSquare : Square" class="size-5" />
              {{ allFilteredSelected ? 'Select none' : query ? 'Select all shown' : 'Select all' }}
            </button>
            <span class="text-muted-foreground ml-auto text-sm font-semibold tabular-nums">{{ selected.size }} selected</span>
          </div>
          <label v-if="items.length > 6" class="bg-card border-strong focus-within:border-primary flex h-11 items-center gap-2 rounded-xl border-2 px-3">
            <Search class="text-muted-foreground size-4 shrink-0" />
            <span class="sr-only">Search {{ spec.plural }}</span>
            <input v-model="query" type="search" :placeholder="`Search ${spec.plural}`" class="min-w-0 flex-1 bg-transparent text-base outline-none" />
            <button v-if="query" type="button" aria-label="Clear search" class="text-muted-foreground -mr-1 flex size-7 items-center justify-center rounded-full" @click="query = ''">
              <X class="size-4" />
            </button>
          </label>
        </SectionHeader>
      </div>

      <slot name="list-intro" />

      <!-- Empty: what it's for, and the ways to add some -->
      <EmptyState v-if="!items.length" :icon="icon" :title="`No ${spec.plural} yet`" :description="spec.emptyHint">
        <button v-if="spec.presets?.length" type="button" :disabled="!canEdit" :class="PRIMARY" @click="openPresets">
          <ListPlus class="size-4" /> Add common {{ spec.plural }}
        </button>
        <slot name="list-actions" :cls="PRIMARY" />
        <RouterLink :to="itemRoute('new')" :replace="split" :class="[hasStart ? SECONDARY : PRIMARY, !canEdit && 'pointer-events-none opacity-50']">
          <Plus class="size-4" /> Add {{ spec.singular }}
        </RouterLink>
      </EmptyState>
      <p v-else-if="!filtered.length" class="text-muted-foreground px-4 py-10 text-center text-base">
        Nothing matches “{{ query }}”.
      </p>

      <!-- Selecting: rows become checkboxes, where the drag handles were -->
      <ul v-else-if="selecting" :class="['divide-y', selected.size ? 'pb-24' : '']">
        <li v-for="item in filtered" :key="item.id">
          <button
            type="button"
            role="checkbox"
            :aria-checked="selected.has(item.id)"
            :class="['flex min-h-14 w-full items-center gap-3 py-2 pr-3 pl-2 text-left', selected.has(item.id) ? 'bg-blue-paper' : 'hover:bg-accent']"
            @click="toggle(item.id)"
          >
            <span
              :class="[
                '-mr-1 flex size-6 shrink-0 items-center justify-center rounded-md border-2',
                selected.has(item.id) ? 'bg-primary-fill border-primary text-primary-foreground' : 'border-strong',
              ]"
            >
              <Check v-if="selected.has(item.id)" class="size-4" stroke-width="3" />
            </span>
            <span v-if="spec.badge" class="bg-paper text-paper-ink min-w-10 shrink-0 rounded-md border px-1.5 py-0.5 text-center font-mono text-sm font-semibold tabular-nums">{{ spec.badge(item) || '–' }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold">{{ spec.title(item) }}</span>
              <span v-if="spec.subtitle?.(item)" class="text-muted-foreground block truncate text-sm">{{ spec.subtitle(item) }}</span>
            </span>
          </button>
        </li>
      </ul>

      <!-- Normal: rows open the item, swipe left to delete; drag handles when reordering is possible -->
      <VueDraggable
        v-else
        v-model="order"
        tag="ul"
        class="divide-y"
        handle="[data-handle]"
        :disabled="!canReorder"
        :animation="150"
        ghost-class="opacity-40"
        @start="dragging = true"
        @end="onDragEnd"
      >
        <li v-for="item in canReorder ? order : filtered" :key="item.id">
          <!-- The row's background and focus ring take in the handle too. -->
          <SwipeRow
            :disabled="!canEdit"
            :remove="() => remove([item.id], true)"
            :class="[
              'has-focus-visible:outline-ring flex items-stretch has-focus-visible:outline-3 has-focus-visible:-outline-offset-3',
              itemId === item.id ? 'bg-blue-paper' : 'bg-background hover:bg-accent',
            ]"
          >
            <span
              v-if="canReorder"
              data-handle
              class="text-muted-foreground flex w-10 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
              :aria-label="`Drag to reorder ${spec.title(item)}`"
            >
              <GripVertical class="size-5" />
            </span>
            <RouterLink
              :to="itemRoute(item.id)"
              :replace="split"
              :aria-current="itemId === item.id ? 'true' : undefined"
              :class="['flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-3 focus-visible:outline-none', canReorder ? 'pl-0' : 'pl-4']"
            >
              <span v-if="spec.badge" class="bg-paper text-paper-ink min-w-10 shrink-0 rounded-md border px-1.5 py-0.5 text-center font-mono text-sm font-semibold tabular-nums">{{ spec.badge(item) || '–' }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-semibold">{{ spec.title(item) }}</span>
                <span v-if="spec.subtitle?.(item)" class="text-muted-foreground block truncate text-sm">{{ spec.subtitle(item) }}</span>
              </span>
              <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
            </RouterLink>
          </SwipeRow>
        </li>
      </VueDraggable>

      <!-- Bulk actions -->
      <div
        v-if="selecting && selected.size"
        class="glass fixed inset-x-3 bottom-[calc(var(--safe-bottom)+0.75rem)] z-20 flex flex-wrap items-center gap-2 rounded-2xl p-2 md:sticky md:inset-x-auto md:bottom-3 md:mx-3"
      >
        <button
          v-for="f in bulkFields"
          :key="f.key"
          type="button"
          :disabled="!canEdit"
          class="bg-card hover:bg-accent h-11 rounded-xl border px-3 text-[0.9375rem] font-bold disabled:opacity-50"
          @click="bulkField = f"
        >
          Set {{ f.label.toLowerCase() }}
        </button>
        <button
          type="button"
          :disabled="!canEdit"
          class="text-destructive bg-card hover:bg-destructive/10 ml-auto flex h-11 items-center gap-1.5 rounded-xl border px-3 text-[0.9375rem] font-bold disabled:opacity-50"
          @click="remove([...selected])"
        >
          <Trash2 class="size-4" /> Delete {{ selected.size }}
        </button>
      </div>
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
          <button type="submit" :disabled="!canEdit || submitting" class="bg-primary-fill text-primary-foreground h-12 rounded-xl px-5 text-base font-bold disabled:opacity-50">
            Add {{ spec.singular }}
          </button>
          <button
            type="button"
            :disabled="!canEdit || submitting"
            class="bg-card border-strong hover:bg-accent h-12 rounded-xl border px-5 text-base font-bold disabled:opacity-50"
            @click="submitDraft(true)"
          >
            Add and add another
          </button>
        </div>
      </form>

      <!-- Editing -->
      <div v-else-if="current" :key="current.id" class="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
        <header class="flex items-center gap-3">
          <span v-if="spec.badge?.(current)" class="bg-paper text-paper-ink shrink-0 rounded-lg border px-2.5 py-1 font-mono text-xl font-semibold tabular-nums">{{ spec.badge(current) }}</span>
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
              :model-value="fieldValue(current, f.key)"
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
          <button
            type="button"
            :disabled="!canEdit"
            class="text-destructive hover:bg-destructive/10 flex h-11 items-center gap-2 rounded-xl px-3 text-[0.9375rem] font-bold disabled:opacity-50"
            @click="remove([current.id])"
          >
            <Trash2 class="size-4" /> Delete {{ spec.singular }}
          </button>
        </footer>
      </div>

      <!-- Gone (deleted elsewhere, or an old link) -->
      <EmptyState v-else :icon="X" :title="`This ${spec.singular} isn’t here any more`" description="It may have been deleted. Choose another from the list." />
    </template>
  </MasterDetail>

  <!-- Presets -->
  <Dialog :open="presetsOpen" variant="sheet" size="md" @close="presetsOpen = false">
    <template #header>
      <h2 class="text-title">Add common {{ spec.plural }}</h2>
      <p class="text-muted-foreground text-sm">Use these where you can: they show what good data looks like and save time. You can rename them afterwards.</p>
    </template>
    <ul class="divide-y">
      <li v-for="(p, i) in spec.presets" :key="i">
        <button
          type="button"
          role="checkbox"
          :aria-checked="presetPicks.has(i)"
          :disabled="presetTaken(i)"
          class="hover:bg-accent flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-50"
          @click="presetPicks.has(i) ? presetPicks.delete(i) : presetPicks.add(i)"
        >
          <span :class="['flex size-6 shrink-0 items-center justify-center rounded-md border-2', presetPicks.has(i) ? 'bg-primary-fill border-primary text-primary-foreground' : 'border-strong']">
            <Check v-if="presetPicks.has(i)" class="size-4" stroke-width="3" />
          </span>
          <span class="min-w-0 flex-1 text-base font-semibold">{{ p.label }}</span>
          <span v-if="presetTaken(i)" class="text-muted-foreground text-sm font-semibold">Added</span>
        </button>
      </li>
    </ul>
    <div class="bg-card sticky bottom-0 border-t p-4 pb-[calc(1rem+var(--safe-bottom))]">
      <button type="button" :disabled="!presetPicks.size" class="bg-primary-fill text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-50" @click="addPresets">
        {{ presetPicks.size ? `Add ${presetPicks.size}` : 'Choose some to add' }}
      </button>
    </div>
  </Dialog>

  <!-- Bulk "Set …" -->
  <Dialog :open="!!bulkField" variant="sheet" @close="bulkField = null">
    <template #header>
      <h2 class="text-title">Set {{ bulkField?.label.toLowerCase() }}</h2>
      <p class="text-muted-foreground text-sm">For {{ selected.size }} {{ selected.size === 1 ? spec.singular : spec.plural }}</p>
    </template>
    <ul class="divide-y pb-[var(--safe-bottom)]">
      <li v-if="!bulkField?.required">
        <button type="button" class="hover:bg-accent flex min-h-13 w-full items-center px-4 text-left text-base font-semibold" @click="applyBulk(null)">None</button>
      </li>
      <li v-for="o in bulkField?.options?.() ?? []" :key="o.value">
        <button type="button" class="hover:bg-accent flex min-h-13 w-full items-center px-4 py-2 text-left text-base font-semibold" @click="applyBulk(o.value)">
          {{ o.label }}
        </button>
      </li>
    </ul>
  </Dialog>
</template>
