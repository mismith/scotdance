<script setup lang="ts">
import { computed, ref } from 'vue'
import { makeDroppable } from '@vue-dnd-kit/core'
import BuilderChip from './BuilderChip.vue'
import DragIndicator from './DragIndicator.vue'
import {
  ids,
  isSpacerId,
  useBuilder,
  type Assignment,
  type CellLocation,
} from './builder'
import { adjust, insertIndex, useDragType, type DragGroup, type DragJudge } from './drag'

// One platform's part of a dance: its age groups in order (spacers mark a
// gap), then its judges. Drop age groups or judges here.

const props = defineProps<{
  cell: Assignment | undefined
  location: CellLocation
  /** The dance on this row, to check which age groups can do it. */
  danceId?: string
}>()

const b = useBuilder()
const el = ref<HTMLElement | null>(null)
const { activeDragGroup, activeDragPayload, pointer } = useDragType()

const groupIds = computed(() => ids(props.cell?.orderedGroupIds))
const judgeIds = computed(() => ids(props.cell?.orderedJudgeIds))

const same = (s: CellLocation) =>
  s.blockId === props.location.blockId &&
  s.eventId === props.location.eventId &&
  s.danceId === props.location.danceId &&
  s.platformId === props.location.platformId

/** Would this drop be accepted here? */
function accepts(d: DragGroup | DragJudge | null): boolean {
  if (!d) return false
  const fromHere = d.source !== 'palette' && same(d.source)
  if (d.type === 'judge') return fromHere || !judgeIds.value.includes(d.judgeId)
  if (isSpacerId(d.groupId)) return true
  return (
    b.eligible(props.danceId, d.groupId) &&
    (fromHere || !groupIds.value.includes(d.groupId))
  )
}

const { isDragOver } = makeDroppable(el, {
  groups: ['group', 'judge'],
  events: {
    onDrop(event) {
      const d = event.draggedItems[0]?.item as DragGroup | DragJudge | undefined
      if (!d || !accepts(d)) return
      const kind = d.type
      const id = d.type === 'group' ? d.groupId : d.judgeId
      const at =
        insertIndex(
          el.value,
          `[data-chip='${kind}']`,
          event.provider.pointer.value?.current.y ?? 0,
        ) ?? 0
      if (d.source === 'palette') void b.addToCell(kind, props.location, id, at)
      else if (same(d.source))
        void b.reorderInCell(kind, props.location, d.index, adjust(at, d.index))
      else void b.moveBetweenCells(kind, d.source, props.location, id, at)
    },
  },
})

const dragKind = computed(() =>
  activeDragGroup.value === 'group' || activeDragGroup.value === 'judge'
    ? activeDragGroup.value
    : null,
)
const valid = computed(
  () =>
    dragKind.value && accepts(activeDragPayload.value as DragGroup | DragJudge | null),
)
const liveIndex = computed(() => {
  if (!isDragOver.value || !valid.value || !pointer.value) return -1
  return insertIndex(el.value, `[data-chip='${dragKind.value}']`, pointer.value.y) ?? -1
})
</script>

<template>
  <div
    ref="el"
    :class="[
      'relative isolate flex min-h-11 flex-col gap-1 rounded-lg p-1 transition-colors',
      valid && dragKind === 'group' && 'bg-group-muted',
      valid && dragKind === 'judge' && 'bg-judge-muted',
      dragKind && !valid && 'opacity-40',
    ]"
  >
    <template v-for="(id, i) in groupIds" :key="id">
      <DragIndicator v-if="dragKind === 'group' && liveIndex === i" class="-my-0.5" />
      <BuilderChip
        :kind="isSpacerId(id) ? 'spacer' : 'group'"
        :label="isSpacerId(id) ? 'Spacer' : b.groupLabel(id)"
        :title="
          isSpacerId(id) ? 'Spacer: a gap between age groups' : b.groupFullLabel(id)
        "
        :data="() => ({ type: 'group', groupId: id, index: i, source: location })"
        removable
        @remove="b.removeFromCell('group', location, id)"
      />
    </template>
    <DragIndicator
      v-if="dragKind === 'group' && liveIndex === groupIds.length"
      class="-my-0.5"
    />

    <div
      v-if="!groupIds.length && !judgeIds.length"
      class="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed px-2 py-1 text-center text-xs"
    >
      Drag age groups or judges here
    </div>

    <div
      v-if="judgeIds.length || dragKind === 'judge'"
      :class="['flex flex-col gap-1', groupIds.length && 'mt-auto pt-1']"
    >
      <template v-for="(id, i) in judgeIds" :key="id">
        <DragIndicator v-if="dragKind === 'judge' && liveIndex === i" class="-my-0.5" />
        <BuilderChip
          kind="judge"
          :label="b.staffName(id)"
          :title="b.staffFullName(id)"
          :data="() => ({ type: 'judge', judgeId: id, index: i, source: location })"
          removable
          @remove="b.removeFromCell('judge', location, id)"
        />
      </template>
      <DragIndicator
        v-if="dragKind === 'judge' && liveIndex === judgeIds.length"
        class="-my-0.5"
      />
    </div>
  </div>
</template>
