<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical, Trophy } from '@lucide/vue'
import Medal from '@/components/Medal.vue'
import NumberTile from '@/components/admin/NumberTile.vue'
import Switch from '@/components/ui/Switch.vue'
import { isPlaceholderId, isTied, placeAt, type Entry, type Placings } from '@/lib/admin/results'
import type { MDancer } from '@/composables/admin/useManagedCompetition'
import { canEdit } from '@/lib/admin/write'

// The placed order for one dance, as in the old admin: tap a dancer to take
// them out, drag to fix the order, and switch on Tie for a dancer tied with
// the one above. Championship results (entered from the lowest place) show
// 1st at the top all the same.

const props = defineProps<{
  placings: Placings
  dancersById: Map<string, MDancer>
  kind: 'callbacks' | 'dance' | 'overall'
}>()

const emit = defineEmits<{
  /** Take out the dancer at this index (in stored order). */
  remove: [index: number]
  tie: [index: number, tie: boolean]
  reorder: [entries: Entry[]]
  /** Choose who a "?" was. */
  fix: [index: number]
}>()

const reverse = computed(() => !!props.placings.reverseFrom)
const isCallbacks = computed(() => props.kind === 'callbacks')

interface Row extends Entry {
  key: string
  index: number
}

// Rows in display order. Callbacks have no order, so they're by number.
const rows = ref<Row[]>([])
const dragging = ref(false)
watch(
  () => props.placings,
  (p) => {
    if (dragging.value) return
    let list = p.entries.map((e, index) => ({ ...e, index, key: `${e.id}-${index}` }))
    if (isCallbacks.value) {
      const num = (r: Row) => props.dancersById.get(r.id)?.num ?? ''
      list = list.sort((a, b) => num(a).localeCompare(num(b), undefined, { numeric: true }))
    } else if (reverse.value) {
      list = list.reverse()
    }
    rows.value = list
  },
  { immediate: true, deep: true },
)

const unknown = (id: string) => isPlaceholderId(id) || !props.dancersById.get(id)
const name = (id: string) => props.dancersById.get(id)?.label ?? (isPlaceholderId(id) ? 'Unknown dancer' : 'Deleted dancer')

// The switch on a row means "tied with the dancer above". In stored order
// that's this dancer's own flag, or (entered from the lowest place) the flag of
// the dancer shown above, which was entered after this one.
const tieIndex = (row: Row) => (reverse.value ? row.index + 1 : row.index)
const tieOn = (row: Row) => !!props.placings.entries[tieIndex(row)]?.tie

const singleOverall = computed(() => props.kind === 'overall' && props.placings.entries.length === 1)

function onEnd(e: { oldIndex?: number; newIndex?: number }) {
  dragging.value = false
  const shown = rows.value.map(({ id, tie }) => ({ id, tie }))
  const entries = reverse.value ? shown.reverse() : shown
  if (e.oldIndex === e.newIndex) return
  // Moving to or from the top: the top dancer can't be tied with the one above.
  if ((e.oldIndex === 0 || e.newIndex === 0) && entries.length) {
    const top = reverse.value ? entries.length - 1 : 0
    entries[top] = { ...entries[top], tie: false }
  }
  emit('reorder', entries)
}
</script>

<template>
  <VueDraggable
    v-model="rows"
    tag="ol"
    class="divide-y"
    handle="[data-handle]"
    :disabled="isCallbacks || !canEdit"
    :animation="150"
    ghost-class="opacity-40"
    @start="dragging = true"
    @end="onEnd"
  >
    <li
      v-for="(row, k) in rows"
      :key="row.key"
      :class="[
        'flex min-h-16 items-center gap-1 pr-2',
        unknown(row.id) && 'bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_oklab,var(--color-next)_60%,transparent)_10px_20px)]',
      ]"
    >
      <span
        v-if="!isCallbacks"
        data-handle
        class="text-muted-foreground flex h-16 w-11 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        aria-hidden="true"
      >
        <GripVertical class="size-5" />
      </span>
      <button
        type="button"
        :disabled="!canEdit"
        :aria-label="`Take out ${name(row.id)}`"
        :class="['press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left disabled:cursor-default', isCallbacks ? 'pl-4' : 'pl-1']"
        @click="emit('remove', row.index)"
      >
        <NumberTile :num="dancersById.get(row.id)?.num" :unknown="unknown(row.id)" />
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
        @click="emit('fix', row.index)"
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
        <Medal v-else :place="placeAt(row.index, placings)" :tied="isTied(row.index, placings)" size="sm" />
      </template>
    </li>
  </VueDraggable>
</template>
