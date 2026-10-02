<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { makeDroppable } from '@vue-dnd-kit/core'
import { CalendarClock, CalendarPlus, Plus, WandSparkles } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import AddPopover from './AddPopover.vue'
import BlockSection from './BlockSection.vue'
import DragIndicator from './DragIndicator.vue'
import { useBuilder } from './builder'
import { useAutoFill } from './autofill'
import { adjust, insertIndex, useDragType, useEdgeScroll, type DragBlock } from './drag'
import { useHideTab } from '@/composables/admin/useHideTab'
import { confirm, toast } from '@/lib/admin/feedback'
import { useMorph } from '@/lib/morph'

// The schedule as a grid: platforms across the top, sessions down the page,
// each event's dances as rows with a cell per platform.

const b = useBuilder()
const auto = useAutoFill()
const hideTab = useHideTab('schedule')
const { activeDragGroup, pointer } = useDragType()


const scrollEl = ref<HTMLElement | null>(null)
useEdgeScroll(scrollEl)

// (No platforms yet: no platform columns, as repeat(0, …) isn't valid CSS.)
const cols = computed(() => {
  const n = b.platforms.value.length
  return `minmax(9rem, auto) ${n ? `repeat(${n}, minmax(13rem, 1fr))` : ''} minmax(0.5rem, auto)`
})

// Sessions reorder by dragging their header.
const gridEl = ref<HTMLElement | null>(null)
makeDroppable(gridEl, {
  groups: ['block'],
  events: {
    onDrop(e) {
      const d = e.draggedItems[0]?.item as DragBlock | undefined
      const at = insertIndex(
        gridEl.value,
        '[data-block]',
        e.provider.pointer.value?.current.y ?? 0,
      )
      if (d && at !== undefined) void b.reorderBlock(d.index, adjust(at, d.index))
    },
  },
})
const liveBlockIndex = computed(() =>
  activeDragGroup.value === 'block' && pointer.value
    ? (insertIndex(gridEl.value, '[data-block]', pointer.value.y) ?? -1)
    : -1,
)

// Adding sessions
const PRESETS = ['Morning', 'Afternoon', 'Evening']
const adding = useMorph()
// The first session swaps the empty state's Add session for the one under
// the grid: closing the menu, the keyboard goes to whichever is there now.
const addBtn = ref<{ $el: HTMLElement } | null>(null)
watch(
  () => adding.open,
  (open) => {
    if (!open) void nextTick(() => document.activeElement === document.body && addBtn.value?.$el.focus())
  },
)
const suggestions = computed(() => {
  const taken = new Set(b.blocks.value.map(([, x]) => x.name?.trim()))
  return PRESETS.filter((n) => !taken.has(n)).map((n) => ({ key: n, label: n }))
})
function addBlock(name: string) {
  b.addBlock(name)
  void nextTick(() =>
    gridEl.value
      ?.querySelector('[data-block]:last-of-type')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
  )
}

// Another day, for competitions over several: shown as tabs above the grid.
const router = useRouter()
function addDay() {
  const dayId = b.addDay()
  void router.replace({
    name: 'manage.schedule',
    params: { competitionId: b.m.competitionId.value, dayId },
  })
}

const canAutofill = computed(
  () => b.categories.value.length > 0 && b.dances.value.length > 0,
)
async function fillSchedule() {
  if (
    b.blocks.value.length &&
    !(await confirm({
      title: 'Replace the schedule?',
      message:
        'Autofill starts over with a morning and afternoon built from the categories, dances, judges and platforms. You can undo this straight after.',
      confirmLabel: 'Replace',
      destructive: true,
    }))
  )
    return
  const change = await auto.fillSchedule()
  if (change != null)
    toast('Autofilled the schedule', {
      action: { label: 'Undo', run: () => b.m.undoChange(change) },
    })
}
</script>

<template>
  <div ref="scrollEl" class="h-full overflow-auto overscroll-contain">
    <!-- Nothing on this day yet: how to start (or, with no schedule at all, not to) -->
    <EmptyState
      v-if="!b.blocks.value.length"
      :icon="CalendarClock"
      :title="b.days.value.length ? 'Nothing on this day yet' : 'No schedule yet'"
      description="Start with a session, like Morning, then add its events and drag dances into them."
    >
      <template v-if="!b.readonly.value">
        <Button ref="addBtn" variant="primary" @click="adding.toggle($event)">
          <Plus /> Add session
        </Button>
        <Button v-if="canAutofill" @click="fillSchedule">
          <WandSparkles /> Autofill the schedule
        </Button>
        <Button v-if="b.days.value.length" @click="addDay">
          <CalendarPlus /> Add day
        </Button>
      </template>
      <template v-if="!b.days.value.length && !b.readonly.value" #footer>
        Not sharing a schedule here?
        <button
          type="button"
          class="text-primary font-semibold underline-offset-2 hover:underline"
          @click="hideTab.hide()"
        >
          Hide the Schedule tab
        </button>
      </template>
    </EmptyState>

    <div
      ref="gridEl"
      :class="[
        'grid w-max min-w-full gap-x-2 px-4 pb-16 text-sm',
        !b.blocks.value.length && 'hidden',
      ]"
      :style="{ gridTemplateColumns: cols }"
    >
      <!-- Platforms across the top -->
      <div
        class="bg-background/90 sticky top-0 z-20 col-span-full grid grid-cols-subgrid py-3 backdrop-blur"
      >
        <div class="flex items-center px-1">
          <RouterLink
            :to="{
              name: 'manage.platforms',
              params: { competitionId: b.m.competitionId.value },
            }"
            class="text-primary text-[0.9375rem] font-bold"
          >
            {{ b.platforms.value.length ? 'Edit platforms' : 'Add platforms' }}
          </RouterLink>
        </div>
        <div
          v-for="p in b.platforms.value"
          :key="p.id"
          class="bg-card flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-base font-bold"
        >
          {{ p.label }}
        </div>
      </div>

      <template v-for="([blockId, block], i) in b.blocks.value" :key="blockId">
        <DragIndicator v-if="liveBlockIndex === i" class="col-span-full -mt-2 mb-1.5" />
        <BlockSection :block="block" :block-id="blockId" :index="i" class="mb-6" />
      </template>
      <DragIndicator
        v-if="liveBlockIndex === b.blocks.value.length"
        class="col-span-full -mt-4 mb-4"
      />

      <!-- After the last session: more, as wide as a phone's screen at most -->
      <div
        v-if="!b.readonly.value && b.blocks.value.length"
        class="col-span-full flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2"
      >
        <Button ref="addBtn" variant="tonal" @click="adding.toggle($event)">
          <Plus /> Add session
        </Button>
        <Button v-if="b.days.value.length" @click="addDay">
          <CalendarPlus /> Add day
        </Button>
        <Button v-if="canAutofill" @click="fillSchedule">
          <WandSparkles /> Autofill the schedule
        </Button>
      </div>
    </div>

    <AddPopover
      :morph="adding"
      :items="suggestions"
      placeholder="Session name…"
      @select="addBlock($event.label)"
      @add="addBlock"
    />
  </div>
</template>
