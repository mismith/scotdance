<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { makeDraggable, makeDroppable } from '@vue-dnd-kit/core'
import { GripVertical, Plus, Trash2 } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import AddPopover from './AddPopover.vue'
import DragIndicator from './DragIndicator.vue'
import EventSection from './EventSection.vue'
import InlineEdit from './InlineEdit.vue'
import { ordered, useBuilder, type SBlock } from './builder'
import {
  ACTIVATION,
  GRIP_TARGET,
  adjust,
  dropLine,
  payload,
  insertIndex,
  useDragHandle,
  useDragType,
  type DragBlock,
  type DragEventData,
} from './drag'
import { confirm } from '@/lib/admin/feedback'
import { useMorph } from '@/lib/morph'

// A session (morning, afternoon…): its name and time, then its events.

const props = defineProps<{
  block: SBlock
  blockId: string
  index: number
}>()

const b = useBuilder()
const { activeDragPayload, pointer } = useDragType()
const events = computed(() => ordered(props.block.events))

const headerEl = ref<HTMLElement | null>(null)
const { isDragging } = makeDraggable(
  headerEl,
  {
    groups: ['block'],
    activation: ACTIVATION,
    dragHandle: useDragHandle(),
    disabled: b.readonly,
  },
  () =>
    payload({
      type: 'block',
      blockId: props.blockId,
      index: props.index,
    } satisfies DragBlock),
)

// Events reorder within their session.
const sectionEl = ref<HTMLElement | null>(null)
const { isDragOver } = makeDroppable(sectionEl, {
  groups: ['event'],
  events: {
    onDrop(e) {
      const d = e.draggedItems[0]?.item as DragEventData | undefined
      if (!d || d.blockId !== props.blockId) return
      const at = insertIndex(
        sectionEl.value,
        '[data-event]',
        e.provider.pointer.value?.current.y ?? 0,
      )
      if (at !== undefined)
        void b.reorderEvent(props.blockId, d.index, adjust(at, d.index))
    },
  },
})
const ownEvent = computed(
  () =>
    activeDragPayload.value?.type === 'event' &&
    activeDragPayload.value.blockId === props.blockId,
)
const liveIndex = computed(() =>
  isDragOver.value && ownEvent.value && pointer.value
    ? (insertIndex(sectionEl.value, '[data-event]', pointer.value.y) ?? -1)
    : -1,
)
const line = computed(() => dropLine(sectionEl.value, '[data-event]', liveIndex.value))

// Adding events: suggestions from the categories.
const BUCKETS = [
  ['Primary', 'Beginner', 'Novice'],
  ['Intermediate', 'Premier', 'Restricted Premier', 'Premier Special'],
]
const adding = useMorph()
const suggestions = computed(() => {
  const taken = new Set(events.value.map(([, e]) => e.name?.trim()))
  const names = b.categories.value.map((c) => c.label)
  const combos = BUCKETS.map((bucket) => bucket.filter((n) => names.includes(n)))
    .filter((x) => x.length > 1)
    .map((x) => x.join(' / '))
  return [...new Set(['Registration', ...names, ...combos, 'Results'])]
    .filter((n) => !taken.has(n))
    .map((n) => ({ key: n, label: n }))
})
const autoEditEvent = ref<string | null>(null)
function addEvent(name: string) {
  b.addEvent(props.blockId, name)
  // (The last event, not `:last-of-type`: the Add event row comes after it.)
  void nextTick(() =>
    [...(sectionEl.value?.querySelectorAll('[data-event]') ?? [])]
      .at(-1)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
  )
}

async function remove() {
  const inside = events.value.length
  if (
    inside &&
    !(await confirm({
      title: `Delete ${props.block.name || 'this session'}?`,
      message: `Its ${inside === 1 ? 'event goes' : `${inside} events go`} too. You can undo this straight after.`,
      confirmLabel: 'Delete',
      destructive: true,
    }))
  )
    return
  void b.removeBlock(props.blockId)
}
</script>

<template>
  <section
    data-block
    class="col-span-full grid grid-cols-subgrid"
    :class="isDragging && 'opacity-40'"
  >
    <div
      ref="sectionEl"
      class="surface relative col-span-full grid grid-cols-subgrid rounded-2xl p-4"
    >
      <div
        ref="headerEl"
        class="group/block col-span-full flex min-h-11 cursor-grab items-center gap-1 px-1 contain-inline-size"
      >
        <span
          data-grip
          :tabindex="b.readonly.value ? undefined : 0"
          :role="b.readonly.value ? undefined : 'button'"
          :aria-label="b.readonly.value ? undefined : `Move ${block.name || 'session'}`"
          :aria-hidden="b.readonly.value || undefined"
          :class="GRIP_TARGET"
          class="text-muted-foreground focus-visible:ring-ring flex shrink-0 touch-none items-center self-stretch rounded-sm outline-none focus-visible:ring-2 pointer-coarse:px-1.5 pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover/block:opacity-100 pointer-fine:focus-visible:opacity-100"
          ><GripVertical class="size-4"
        /></span>
        <h2 class="text-heading">
          <InlineEdit
            :model-value="block.name ?? ''"
            placeholder="Session name"
            label="Session name"
            :readonly="b.readonly.value"
            @update:model-value="b.renameBlock(blockId, $event)"
          />
        </h2>
        <button
          v-if="!b.readonly.value"
          type="button"
          :aria-label="`Delete ${block.name || 'session'}`"
          class="press text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto flex size-11 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/block:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          @click="remove"
          @keydown.enter.stop
          @keydown.space.stop
        >
          <Trash2 class="size-4" />
        </button>
      </div>
      <div class="col-span-full mb-3 pr-1 pl-6 text-sm contain-inline-size">
        <InlineEdit
          :model-value="block.description ?? ''"
          placeholder="Add a time or note"
          label="Session time and notes"
          :required="false"
          multiline
          :readonly="b.readonly.value"
          class="text-muted-foreground"
          @update:model-value="b.describeBlock(blockId, $event)"
        />
      </div>

      <template v-for="([eventId, event], i) in events" :key="eventId">
        <EventSection
          :event="event"
          :block-id="blockId"
          :event-id="eventId"
          :index="i"
          :auto-edit="autoEditEvent === eventId"
        />
      </template>
      <DragIndicator v-if="line" class="inset-x-4" :style="line" />

      <div v-if="!b.readonly.value" class="col-span-full mt-3">
        <Button variant="plain" class="-ml-3" @click="adding.toggle($event)">
          <Plus /> Add event
        </Button>
        <AddPopover
          :morph="adding"
          :items="suggestions"
          placeholder="Event name…"
          @select="addEvent($event.label)"
          @add="addEvent"
        />
      </div>
    </div>
  </section>
</template>
