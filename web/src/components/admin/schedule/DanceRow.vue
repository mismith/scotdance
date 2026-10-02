<script setup lang="ts">
import { computed, ref } from 'vue'
import { makeDraggable } from '@vue-dnd-kit/core'
import { GripVertical, Trash2 } from '@lucide/vue'
import BuilderChip from './BuilderChip.vue'
import InlineEdit from './InlineEdit.vue'
import PlatformCell from './PlatformCell.vue'
import { ids, useBuilder, type SDance } from './builder'
import { ACTIVATION, payload, useDragHandle, type DragDance } from './drag'
import { confirm } from '@/lib/admin/feedback'

// One row of an event: a dance across the platforms, or another row
// (Registration, March Past…) spanning them all.

const props = defineProps<{
  row: SDance
  blockId: string
  eventId: string
  rowId: string
  index: number
  autoEdit?: boolean
}>()

const b = useBuilder()
const drag = (): DragDance => ({
  type: 'dance',
  danceId: props.row.danceId,
  rowId: props.rowId,
  index: props.index,
  source: { blockId: props.blockId, eventId: props.eventId },
})

// Other rows drag by the whole row; dances by their chip.
const rowEl = ref<HTMLElement | null>(null)
const { isDragging } = makeDraggable(
  rowEl,
  {
    groups: ['dance'],
    activation: ACTIVATION,
    dragHandle: useDragHandle(),
    disabled: computed(() => b.readonly.value || !!props.row.danceId),
  },
  () => payload(drag()),
)

const dance = computed(() => b.getDance(props.row.danceId))
const steps = computed(() => String(dance.value?.steps ?? '').trim())

async function remove() {
  const assigned = Object.values(props.row.platforms ?? {}).some(
    (p) => ids(p?.orderedGroupIds).length || ids(p?.orderedJudgeIds).length,
  )
  if (
    assigned &&
    !(await confirm({
      title: `Delete ${b.danceName(props.row.danceId)}?`,
      message:
        'Its age groups and judges on each platform go too. You can undo this straight after.',
      confirmLabel: 'Delete',
      destructive: true,
    }))
  )
    return
  void b.removeRow(props.blockId, props.eventId, props.rowId)
}
</script>

<template>
  <div
    v-if="!row.danceId"
    data-row
    class="group/row col-span-full border-t contain-inline-size first:border-t-0"
  >
    <div
      ref="rowEl"
      :class="[
        'flex cursor-grab items-start gap-1 px-1 py-2 text-sm',
        isDragging && 'opacity-40',
      ]"
    >
      <span
        data-grip
        :tabindex="b.readonly.value ? undefined : 0"
        :role="b.readonly.value ? undefined : 'button'"
        :aria-label="b.readonly.value ? undefined : `Move ${row.name || 'row'}`"
        :aria-hidden="b.readonly.value || undefined"
        class="text-muted-foreground focus-visible:ring-ring flex shrink-0 touch-none self-stretch rounded-sm pt-0.5 outline-none focus-visible:ring-2 pointer-coarse:px-1.5 pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-visible:opacity-100"
        ><GripVertical class="size-3.5"
      /></span>
      <div class="min-w-0 flex-1 space-y-1">
        <div class="font-semibold">
          <InlineEdit
            :model-value="row.name ?? ''"
            placeholder="Row name"
            label="Row name"
            :auto-edit="autoEdit"
            :readonly="b.readonly.value"
            @update:model-value="b.setRowText(blockId, eventId, rowId, 'name', $event)"
          />
        </div>
        <InlineEdit
          :model-value="row.description ?? ''"
          placeholder="Add a time or note"
          label="Note"
          :required="false"
          multiline
          :readonly="b.readonly.value"
          class="text-muted-foreground"
          @update:model-value="
            b.setRowText(blockId, eventId, rowId, 'description', $event)
          "
        />
      </div>
      <button
        v-if="!b.readonly.value"
        type="button"
        :aria-label="`Delete ${row.name || 'row'}`"
        class="press text-muted-foreground hover:text-destructive hover:bg-destructive/10 -my-2 flex size-11 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        @click="remove"
        @keydown.enter.stop
        @keydown.space.stop
      >
        <Trash2 class="size-4" />
      </button>
    </div>
  </div>

  <div
    v-else
    data-row
    class="col-span-full grid grid-cols-subgrid border-t first:border-t-0"
  >
    <div class="px-1 py-1.5">
      <BuilderChip
        kind="dance"
        :label="b.danceName(row.danceId)"
        :title="dance?.label"
        :data="drag"
        removable
        @remove="remove"
      >
        {{ b.danceName(row.danceId)
        }}<span v-if="steps" class="text-muted-foreground ml-1 font-normal"
          >({{ steps }})</span
        >
      </BuilderChip>
    </div>
    <PlatformCell
      v-for="p in b.shownPlatforms.value"
      :key="p.id"
      :cell="row.platforms?.[p.id]"
      :location="{ blockId, eventId, danceId: rowId, platformId: p.id }"
      :dance-id="row.danceId"
      class="my-0.5"
    />
    <div />
  </div>
</template>
