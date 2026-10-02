<script setup lang="ts">
import { computed, ref } from 'vue'
import { makeDraggable, makeDroppable } from '@vue-dnd-kit/core'
import { GripVertical, Plus, Trash2 } from '@lucide/vue'
import DanceRow from './DanceRow.vue'
import DragIndicator from './DragIndicator.vue'
import InlineEdit from './InlineEdit.vue'
import AutoFillMenu from './AutoFillMenu.vue'
import { ordered, useBuilder, type SEvent } from './builder'
import {
  ACTIVATION,
  adjust,
  dropLine,
  payload,
  insertIndex,
  useDragHandle,
  useDragType,
  type DragDance,
  type DragEventData,
} from './drag'
import { confirm } from '@/lib/admin/feedback'

// An event in a session: its name and note, then its rows. Drop dances here
// from the palette, or from other events.

const props = defineProps<{
  event: SEvent
  blockId: string
  eventId: string
  index: number
  autoEdit?: boolean
}>()

const b = useBuilder()
const { activeDragGroup, pointer } = useDragType()
const rows = computed(() => ordered(props.event.dances))

const headerEl = ref<HTMLElement | null>(null)
const { isDragging } = makeDraggable(
  headerEl,
  {
    groups: ['event'],
    activation: ACTIVATION,
    dragHandle: useDragHandle(),
    disabled: b.readonly,
  },
  () =>
    payload({
      type: 'event',
      eventId: props.eventId,
      blockId: props.blockId,
      index: props.index,
    } satisfies DragEventData),
)

const rowsEl = ref<HTMLElement | null>(null)
const { isDragOver } = makeDroppable(rowsEl, {
  groups: ['dance'],
  events: {
    onDrop(e) {
      const d = e.draggedItems[0]?.item as DragDance | undefined
      if (!d) return
      const at =
        insertIndex(
          rowsEl.value,
          '[data-row]',
          e.provider.pointer.value?.current.y ?? 0,
        ) ?? 0
      const here = { blockId: props.blockId, eventId: props.eventId }
      if (d.source === 'palette')
        b.addRow(props.blockId, props.eventId, { danceId: d.danceId }, at)
      else if (d.source.blockId === here.blockId && d.source.eventId === here.eventId)
        void b.reorderRow(props.blockId, props.eventId, d.index, adjust(at, d.index))
      else void b.moveRow(d.source, d.rowId, here, at)
    },
  },
})
const draggingDance = computed(() => activeDragGroup.value === 'dance')
const liveIndex = computed(() =>
  isDragOver.value && pointer.value
    ? (insertIndex(rowsEl.value, '[data-row]', pointer.value.y) ?? -1)
    : -1,
)
const line = computed(() => dropLine(rowsEl.value, '[data-row]', liveIndex.value))

const autoEditRow = ref<string | null>(null)
function addRow() {
  autoEditRow.value = b.addRow(props.blockId, props.eventId, { name: 'New row' })
}

async function remove() {
  const inside = rows.value.length
  if (
    inside &&
    !(await confirm({
      title: `Delete ${props.event.name || 'this event'}?`,
      message: `Its ${inside === 1 ? 'row goes' : `${inside} rows go`} too. You can undo this straight after.`,
      confirmLabel: 'Delete',
      destructive: true,
    }))
  )
    return
  void b.removeEvent(props.blockId, props.eventId)
}
</script>

<template>
  <div
    data-event
    class="col-span-full mb-4 grid grid-cols-subgrid last:mb-0"
    :class="isDragging && 'opacity-40'"
  >
    <div
      ref="headerEl"
      class="group/event bg-muted/60 col-span-full flex min-h-11 cursor-grab items-center gap-1 rounded-xl px-1 text-base font-semibold contain-inline-size"
    >
      <span
        data-grip
        :tabindex="b.readonly.value ? undefined : 0"
        :role="b.readonly.value ? undefined : 'button'"
        :aria-label="b.readonly.value ? undefined : `Move ${event.name || 'event'}`"
        :aria-hidden="b.readonly.value || undefined"
        class="text-muted-foreground focus-visible:ring-ring flex shrink-0 touch-none items-center self-stretch rounded-sm outline-none focus-visible:ring-2 pointer-coarse:px-1.5 pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover/event:opacity-100 pointer-fine:focus-visible:opacity-100"
        ><GripVertical class="size-4"
      /></span>
      <InlineEdit
        :model-value="event.name ?? ''"
        placeholder="Event name"
        label="Event name"
        :auto-edit="autoEdit"
        :readonly="b.readonly.value"
        @update:model-value="b.renameEvent(blockId, eventId, $event)"
      />
      <div class="ml-auto flex items-center gap-1">
        <AutoFillMenu v-if="!b.readonly.value" :block-id="blockId" :event-id="eventId" />
        <button
          v-if="!b.readonly.value"
          type="button"
          :aria-label="`Delete ${event.name || 'event'}`"
          class="press text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex size-11 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/event:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          @click="remove"
          @keydown.enter.stop
          @keydown.space.stop
        >
          <Trash2 class="size-4" />
        </button>
      </div>
    </div>
    <div class="col-span-full py-1.5 pr-1 pl-6 text-sm contain-inline-size">
      <InlineEdit
        :model-value="event.description ?? ''"
        placeholder="Add a time or note"
        label="Event note"
        :required="false"
        multiline
        :readonly="b.readonly.value"
        class="text-muted-foreground"
        @update:model-value="b.describeEvent(blockId, eventId, $event)"
      />
    </div>

    <div
      ref="rowsEl"
      :class="[
        'relative isolate col-span-full grid grid-cols-subgrid rounded-lg transition-colors',
        draggingDance && 'bg-dance-muted outline-dance-muted outline-4',
      ]"
    >
      <template v-for="([rowId, row], i) in rows" :key="rowId">
        <DanceRow
          :row="row"
          :block-id="blockId"
          :event-id="eventId"
          :row-id="rowId"
          :index="i"
          :auto-edit="autoEditRow === rowId"
        />
      </template>
      <DragIndicator v-if="line" class="inset-x-0" :style="line" />

      <div v-if="!b.readonly.value" class="col-span-full mt-1 grid grid-cols-subgrid">
        <div class="p-1">
          <button
            type="button"
            title="A row without a dance, like Registration or March Past"
            class="text-primary press-row flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2 text-left text-sm font-semibold"
            @click="addRow"
          >
            <Plus class="size-4" /> Add row
          </button>
        </div>
        <div class="col-[2/-2] p-1">
          <div
            class="text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed px-2 py-1 text-xs"
          >
            Drag dances here
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
