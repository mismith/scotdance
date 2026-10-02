<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { makeDroppable } from '@vue-dnd-kit/core'
import { Plus } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import { useMorph } from '@/lib/morph'
import BuilderChip from './BuilderChip.vue'
import DragIndicator from './DragIndicator.vue'
import {
  ids,
  isSpacerId,
  useBuilder,
  type Assignment,
  type CellLocation,
} from './builder'
import { adjust, dropLine, insertIndex, useDragType, type DragGroup, type DragJudge } from './drag'

// One platform's part of a dance: its age groups in order (spacers mark a
// gap), then its judges. Drop age groups or judges here; on a touch screen,
// Add picks them from a list instead.

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
// One line that glides from gap to gap as the drag moves.
const line = computed(() => dropLine(el.value, `[data-chip='${dragKind.value}']`, liveIndex.value))

// --- Adding from a list (touch screens, where dragging across a grid is fiddly)
const touch = useMediaQuery('(pointer: coarse)')
const picker = useMorph()
const platformName = computed(() => b.platforms.value.find((p) => p.id === props.location.platformId)?.label ?? 'this platform')
/** Where else in this dance's row something already is. */
function elsewhere(kind: 'group' | 'judge', id: string) {
  const row = b.getRow(props.location.blockId, props.location.eventId, props.location.danceId)
  const where = Object.entries(row?.platforms ?? {})
    .filter(([pid, cell]) => pid !== props.location.platformId && ids(kind === 'group' ? cell?.orderedGroupIds : cell?.orderedJudgeIds).includes(id))
    .map(([pid]) => b.platforms.value.find((p) => p.id === pid)?.label)
    .filter(Boolean)
  return where.length ? `On ${where.join(' and ')}` : null
}
const choices = computed(() => ({
  group: b.m.groups.value.filter((g) => b.eligible(props.danceId, g.id)).map((g) => ({ id: g.id, label: g.label, on: groupIds.value.includes(g.id) })),
  judge: b.judges.value.map((j) => ({ id: j.id, label: j.label, on: judgeIds.value.includes(j.id) })),
}))
function flip(kind: 'group' | 'judge', id: string, on: boolean) {
  if (on) void b.removeFromCell(kind, props.location, id)
  else void b.addToCell(kind, props.location, id)
}

// A chip arriving (dropped, or added from the list) settles in with a tint.
const LAND = {
  enterActiveClass: 'transition-[scale,background-color] duration-(--dur-slow) [transition-timing-function:var(--ease-elastic),var(--ease-standard)] motion-reduce:transition-colors',
  enterFromClass: 'scale-96 bg-blue-paper! motion-reduce:scale-100',
  moveClass: 'transition-transform duration-(--dur-base) ease-snappy motion-reduce:transition-none',
}
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
    <TransitionGroup tag="div" class="flex flex-col gap-1 empty:hidden" v-bind="LAND">
      <BuilderChip
        v-for="(id, i) in groupIds"
        :key="id"
        :kind="isSpacerId(id) ? 'spacer' : 'group'"
        :label="isSpacerId(id) ? 'Spacer' : b.groupLabel(id)"
        :title="
          isSpacerId(id) ? 'Spacer: a gap between age groups' : b.groupFullLabel(id)
        "
        :data="() => ({ type: 'group', groupId: id, index: i, source: location })"
        removable
        @remove="b.removeFromCell('group', location, id)"
      />
    </TransitionGroup>

    <template v-if="!groupIds.length && !judgeIds.length">
      <button
        v-if="touch && !b.readonly.value"
        type="button"
        class="text-primary press flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-dashed text-sm font-semibold"
        :aria-label="`Add age groups or judges to ${platformName}`"
        @click="picker.show($event)"
      >
        <Plus class="size-4" /> Add
      </button>
      <div
        v-else
        class="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed px-2 py-1 text-center text-xs"
      >
        Drag age groups or judges here
      </div>
    </template>

    <TransitionGroup
      v-if="judgeIds.length || dragKind === 'judge'"
      tag="div"
      :class="['flex flex-col gap-1', groupIds.length && 'mt-auto pt-1']"
      v-bind="LAND"
    >
      <BuilderChip
        v-for="(id, i) in judgeIds"
        :key="id"
        kind="judge"
        :label="b.staffName(id)"
        :title="b.staffFullName(id)"
        :data="() => ({ type: 'judge', judgeId: id, index: i, source: location })"
        removable
        @remove="b.removeFromCell('judge', location, id)"
      />
    </TransitionGroup>

    <button
      v-if="touch && !b.readonly.value && (groupIds.length || judgeIds.length)"
      type="button"
      class="text-primary press -mb-1 flex min-h-11 items-center gap-1 rounded-lg px-1.5 text-sm font-semibold"
      :aria-label="`Add age groups or judges to ${platformName}`"
      @click="picker.show($event)"
    >
      <Plus class="size-4" /> Add
    </button>

    <Transition
      enter-active-class="transition-opacity duration-(--dur-quick)"
      enter-from-class="opacity-0"
    >
      <DragIndicator v-if="line" class="inset-x-1" :style="line" />
    </Transition>

    <!-- Picking from a list: tap to add or take off, in either order. (Out
         of the grid, so its taps and keys never reach a drag.) -->
    <Teleport to="body">
      <Dialog :open="picker.open" :morph="picker" variant="sheet" size="md" @close="picker.hide()">
        <template #header>
          <h2 class="text-title">{{ b.danceName(danceId) }}</h2>
          <p class="text-muted-foreground text-sm">On {{ platformName }}</p>
        </template>
        <section v-for="kind in (['group', 'judge'] as const)" :key="kind" class="pb-2 last:pb-[calc(0.5rem+var(--safe-bottom))]">
          <h3 class="text-heading px-4 pt-4 pb-1">{{ kind === 'group' ? 'Age groups' : 'Judges' }}</h3>
          <p v-if="!choices[kind].length" class="text-muted-foreground px-4 py-2 text-sm">
            {{ kind === 'group' ? 'No age groups do this dance yet.' : 'No judges yet.' }}
          </p>
          <ul class="divide-y">
            <li v-for="c in choices[kind]" :key="c.id">
              <button
                type="button"
                role="checkbox"
                :aria-checked="c.on"
                class="press-row focus-inset flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left"
                @click="flip(kind, c.id, c.on)"
              >
                <Checkbox :checked="c.on" />
                <span class="min-w-0 flex-1">
                  <span class="block text-base font-medium">{{ c.label }}</span>
                  <span v-if="elsewhere(kind, c.id)" class="text-muted-foreground block text-sm">{{ elsewhere(kind, c.id) }}</span>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </Dialog>
    </Teleport>
  </div>
</template>
