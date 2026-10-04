<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical, Trophy } from '@lucide/vue'
import Medal from '@/components/Medal.vue'
import NumberTile from '@/components/admin/NumberTile.vue'
import Switch from '@/components/ui/Switch.vue'
import { isPlaceholderId, isTied, placeAt, type Entry, type Placings } from '@/lib/admin/results'
import type { MDancer } from '@/composables/admin/useManagedCompetition'
import { canEdit } from '@/lib/admin/write'

// The placed order for one dance, as in the old admin: tap a dancer to take
// them out, drag to fix the order (or pick a row up by its handle from the
// keyboard), and switch on Tie for a dancer tied with the one above.
// Championship results (entered from the lowest place) show 1st at the top
// all the same. Rows glide to their places (not while dragging: the drag
// shows the move), fold away as they leave (out of reach of a quick second
// tap), and a new placing's rosette flips in.

const props = defineProps<{
  placings: Placings
  dancersById: Map<string, MDancer>
  kind: 'callbacks' | 'dance' | 'overall'
}>()

const emit = defineEmits<{
  /** Take out this dancer, at this index (in stored order). */
  remove: [index: number, id: string]
  tie: [index: number, tie: boolean]
  /** The new order (in stored order), and who was moved. */
  reorder: [entries: Entry[], moved: string]
  /** Choose who this "?" was. */
  fix: [id: string]
}>()

const reverse = computed(() => !!props.placings.reverseFrom)
const isCallbacks = computed(() => props.kind === 'callbacks')

interface Row extends Entry {
  key: string
  index: number
}

// Rows in display order. Callbacks have no order, so they're by number.
// Keyed by dancer, so a row keeps its element as it moves.
const rows = ref<Row[]>([])
const dragging = ref(false)
// A row picked up from the keyboard (by key), while it's moved with the arrows.
const lifted = ref<string | null>(null)
function build(p: Placings) {
  const seen = new Map<string, number>()
  let list = p.entries.map((e, index) => {
    const n = seen.get(e.id) ?? 0
    seen.set(e.id, n + 1)
    return { ...e, index, key: n ? `${e.id}#${n}` : e.id }
  })
  if (isCallbacks.value) {
    const num = (r: Row) => props.dancersById.get(r.id)?.num ?? ''
    list = list.sort((a, b) => num(a).localeCompare(num(b), undefined, { numeric: true }))
  } else if (reverse.value) {
    list = list.reverse()
  }
  rows.value = list
}
// The placing that just arrived (one at a time), not those there on opening.
const fresh = ref<string | null>(null)
let known: Set<string> | null = null
watch(
  () => props.placings,
  (p) => {
    if (dragging.value || lifted.value) return
    const ids = new Set(p.entries.map((e) => e.id))
    const added = known ? [...ids].filter((id) => !known?.has(id)) : []
    if (added.length === 1) fresh.value = added[0]
    known = ids
    build(p)
  },
  { immediate: true, deep: true },
)

const unknown = (id: string) => isPlaceholderId(id) || !props.dancersById.get(id)
const name = (id: string) => props.dancersById.get(id)?.label ?? (isPlaceholderId(id) ? 'Missed number' : 'Deleted dancer')

// The switch on a row means "tied with the dancer above". In stored order
// that's this dancer's own flag, or (entered from the lowest place) the flag of
// the dancer shown above, which was entered after this one.
const tieIndex = (row: Row) => (reverse.value ? row.index + 1 : row.index)
const tieOn = (row: Row) => !!props.placings.entries[tieIndex(row)]?.tie

const singleOverall = computed(() => props.kind === 'overall' && props.placings.entries.length === 1)

// Gliding stays off from picking a row up until the drop has settled.
const still = ref(false)
function onStart() {
  dragging.value = true
  still.value = true
}
/** Save the order shown, after one row moved from `from` to `to` in it. */
function commit(from: number, to: number, moved: string) {
  if (from === to) return
  const shown = rows.value.map(({ id, tie }) => ({ id, tie }))
  const entries = reverse.value ? shown.reverse() : shown
  // Moving to or from the top: the top dancer can't be tied with the one above.
  if ((from === 0 || to === 0) && entries.length) {
    const top = reverse.value ? entries.length - 1 : 0
    entries[top] = { ...entries[top], tie: false }
  }
  emit('reorder', entries, moved)
}
function onEnd(e: { oldIndex?: number; newIndex?: number }) {
  dragging.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => (still.value = false)))
  const moved = rows.value[e.newIndex ?? -1]?.id
  if (e.oldIndex == null || e.newIndex == null || moved == null) return
  commit(e.oldIndex, e.newIndex, moved)
}

// From the keyboard, as in the other Manage lists: Space or Enter picks a
// row up by its handle, the arrow keys move it, Space or Enter drops it (and
// saves), Escape puts it back.
const announcement = ref('')
let liftedFrom = -1
let movingFocus = false
function focusHandle(key: string) {
  movingFocus = true
  void nextTick(() => {
    document.querySelector<HTMLElement>(`[data-handle-for="${CSS.escape(key)}"]`)?.focus()
    movingFocus = false
  })
}
function onHandleKey(e: KeyboardEvent, row: Row) {
  const at = rows.value.findIndex((r) => r.key === row.key)
  const where = (i: number) => `${i + 1} of ${rows.value.length}`
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (lifted.value !== row.key) {
      lifted.value = row.key
      liftedFrom = at
      announcement.value = `Picked up ${name(row.id)}, ${where(at)}. Use the arrow keys to move them, Space to drop, Escape to put them back.`
    } else {
      lifted.value = null
      announcement.value = `Dropped ${name(row.id)} at ${where(at)}.`
      // Dropped where it started: nothing to save, but catch up on any change
      // made elsewhere while it was held.
      if (liftedFrom === at) build(props.placings)
      else commit(liftedFrom, at, row.id)
    }
  } else if (lifted.value === row.key && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    const to = at + (e.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= rows.value.length) return
    const next = [...rows.value]
    next.splice(to, 0, ...next.splice(at, 1))
    rows.value = next
    announcement.value = where(to)
    focusHandle(row.key)
  } else if (lifted.value === row.key && e.key === 'Escape') {
    // Not the sheet's Escape too.
    e.preventDefault()
    e.stopPropagation()
    putBack(row)
  }
}
function putBack(row: Row, refocus = true) {
  lifted.value = null
  build(props.placings)
  announcement.value = `${name(row.id)} put back.`
  if (refocus) focusHandle(row.key)
}
// Leaving a row while it's held puts it back (without pulling focus back to it).
function onHandleBlur(row: Row) {
  if (!movingFocus && lifted.value === row.key) putBack(row, false)
}
</script>

<template>
  <VueDraggable
    v-model="rows"
    target="ol"
    handle="[data-handle]"
    :disabled="isCallbacks || !canEdit"
    :animation="150"
    ghost-class="opacity-40"
    @start="onStart"
    @end="onEnd"
  >
    <TransitionGroup
      tag="ol"
      class="divide-y"
      :move-class="still ? undefined : 'transition-transform duration-(--dur-slow) ease-elastic motion-reduce:transition-none'"
      enter-active-class="transition-[opacity,translate] duration-(--dur-base) ease-snappy"
      enter-from-class="opacity-0 motion-safe:-translate-y-2"
      leave-active-class="pointer-events-none overflow-hidden transition-[max-height,opacity] duration-(--dur-base) ease-standard motion-reduce:transition-opacity"
      leave-from-class="max-h-17"
      leave-to-class="max-h-0 opacity-0"
    >
      <li
        v-for="(row, k) in rows"
        :key="row.key"
        :class="[
          'flex min-h-16 items-center gap-1 pr-2',
          lifted === row.key && 'surface-raised relative z-1',
          unknown(row.id) && 'relative bg-next/40 bg-[repeating-linear-gradient(135deg,transparent_0_9px,color-mix(in_oklab,var(--next-foreground)_7%,transparent)_9px_11px)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[repeating-linear-gradient(135deg,var(--next-foreground)_0_3px,transparent_3px_6px)]',
        ]"
      >
        <button
          v-if="!isCallbacks"
          type="button"
          data-handle
          :data-handle-for="row.key"
          :disabled="!canEdit"
          :aria-label="`Move ${name(row.id)}`"
          :aria-pressed="lifted === row.key"
          class="text-muted-foreground focus-inset flex h-16 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg active:cursor-grabbing disabled:cursor-default"
          @keydown="onHandleKey($event, row)"
          @blur="onHandleBlur(row)"
        >
          <GripVertical class="size-5" />
        </button>
        <button
          type="button"
          :disabled="!canEdit"
          :aria-label="`Take out ${name(row.id)}`"
          :class="['press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left disabled:cursor-default', isCallbacks ? 'pl-4' : 'pl-1']"
          @click="emit('remove', row.index, row.id)"
        >
          <NumberTile :num="dancersById.get(row.id)?.num" :unknown="unknown(row.id)" :data-tile="row.id" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">{{ name(row.id) }}</span>
            <span v-if="dancersById.get(row.id)?.location" class="text-muted-foreground block truncate text-sm">{{ dancersById.get(row.id)?.location }}</span>
          </span>
        </button>
        <button
          v-if="unknown(row.id)"
          type="button"
          :disabled="!canEdit"
          class="press bg-next text-next-foreground relative h-9 shrink-0 rounded-full px-3 text-sm font-semibold after:absolute after:-inset-y-1 after:inset-x-0 disabled:opacity-(--disabled-opacity)"
          @click="emit('fix', row.id)"
        >
          Choose
        </button>
        <template v-if="!isCallbacks">
          <label v-if="k > 0" class="flex h-11 shrink-0 items-center gap-1.5 pl-1.5">
            <span :class="['text-footnote font-semibold transition-colors duration-(--dur-quick)', tieOn(row) ? 'text-primary' : 'text-muted-foreground']" aria-hidden="true">Tie</span>
            <Switch
              :model-value="tieOn(row)"
              aria-label="Tied with the dancer above"
              :disabled="!canEdit"
              @update:model-value="(on: boolean) => emit('tie', tieIndex(row), on)"
            />
          </label>
          <span v-else class="w-[5.375rem] shrink-0" />
          <Trophy v-if="singleOverall" class="text-primary mx-1 size-7 shrink-0" />
          <Medal v-else :place="placeAt(row.index, placings)" :tied="isTied(row.index, placings)" :fresh="row.id === fresh" size="sm" />
        </template>
      </li>
    </TransitionGroup>
    <p class="sr-only" aria-live="assertive">{{ announcement }}</p>
  </VueDraggable>
</template>
