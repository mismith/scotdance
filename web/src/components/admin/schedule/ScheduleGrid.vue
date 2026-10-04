<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { makeDroppable } from '@vue-dnd-kit/core'
import { CalendarClock, CalendarPlus, Plus, WandSparkles } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import Segmented from '@/components/ui/Segmented.vue'
import AddPopover from './AddPopover.vue'
import BlockSection from './BlockSection.vue'
import DragIndicator from './DragIndicator.vue'
import { useBuilder } from './builder'
import { useAutoFill } from './autofill'
import { adjust, dropLine, insertIndex, useDragInterrupts, useDragType, useEdgeScroll, type DragBlock } from './drag'
import { useHideTab } from '@/composables/admin/useHideTab'
import { useSplit } from '@/composables/admin/useWide'
import { confirm, toast } from '@/lib/admin/feedback'
import { useMorph } from '@/lib/morph'

// The schedule as a grid: platforms across the top, sessions down the page,
// each event's dances as rows with a cell per platform.

const b = useBuilder()
const auto = useAutoFill()
const hideTab = useHideTab('schedule')
const { activeDragGroup, pointer } = useDragType()

// On a phone, one platform at a time: a grid of them is a puzzle there.
const split = useSplit()
const picked = ref<string | null>(null)
watchEffect(() => {
  const all = b.platforms.value
  const keep = all.some((p) => p.id === picked.value) ? picked.value : (all[0]?.id ?? null)
  b.platformView.value = split.value ? null : keep
  if (!split.value) picked.value = keep
})
// "Platform A" and "Platform B" are A and B side by side.
const platformChoices = computed(() =>
  b.platforms.value.map((p) => ({ value: p.id, label: p.label.replace(/^platform\s+/i, '') || p.label })),
)

const scrollEl = ref<HTMLElement | null>(null)
useEdgeScroll(scrollEl)
useDragInterrupts()

// (No platforms yet: no platform columns, as repeat(0, …) isn't valid CSS.)
// On a phone the one platform shares the screen's width with the dances.
const cols = computed(() => {
  const n = b.shownPlatforms.value.length
  if (!split.value) return `minmax(0, 1fr) ${n ? 'minmax(0, 1fr)' : ''} 0`
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
const line = computed(() => dropLine(gridEl.value, '[data-block]', liveBlockIndex.value))

// Adding sessions
const PRESETS = ['Morning', 'Afternoon', 'Evening']
const adding = useMorph()
// The first session swaps the empty state's Add session for the one under
// the grid: closing the menu, the keyboard goes to whichever is there now.
const addBtn = ref<{ $el: HTMLElement } | null>(null)
watch(
  () => adding.open,
  (open) => {
    // (The dialog hands focus back to what opened it, if that's still there.)
    if (!open && !adding.trigger?.isConnected) void nextTick(() => addBtn.value?.$el.focus())
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
        'relative grid min-w-full gap-x-2 px-4 pb-16 text-sm md:w-max',
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
            class="text-primary text-callout flex min-h-11 items-center font-semibold"
          >
            {{ b.platforms.value.length ? 'Edit platforms' : 'Add platforms' }}
          </RouterLink>
        </div>
        <Segmented
          v-if="!split && b.platforms.value.length > 1"
          :model-value="picked ?? ''"
          :options="platformChoices"
          label="Platform"
          @update:model-value="picked = $event"
        />
        <template v-else>
          <div
            v-for="p in b.shownPlatforms.value"
            :key="p.id"
            class="surface flex min-h-11 items-center justify-center rounded-xl px-2 text-center text-base font-semibold"
          >
            {{ p.label }}
          </div>
        </template>
      </div>

      <BlockSection v-for="([blockId, block], i) in b.blocks.value" :key="blockId" :block="block" :block-id="blockId" :index="i" class="mb-6" />
      <DragIndicator v-if="line" class="inset-x-4" :style="line" />

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
