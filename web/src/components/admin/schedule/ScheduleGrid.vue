<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { makeAutoScroll, makeDroppable } from '@vue-dnd-kit/core'
import { Plus, WandSparkles } from '@lucide/vue'
import AddPopover from './AddPopover.vue'
import BlockSection from './BlockSection.vue'
import DragIndicator from './DragIndicator.vue'
import { useBuilder } from './builder'
import { useAutoFill } from './autofill'
import { adjust, insertIndex, useDragType, type DragBlock } from './drag'
import { confirm, toast } from '@/lib/admin/feedback'

// The schedule as a grid: platforms across the top, sessions down the page,
// each event's dances as rows with a cell per platform.

const b = useBuilder()
const auto = useAutoFill()
const { activeDragGroup, pointer } = useDragType()

const scrollEl = ref<HTMLElement | null>(null)
makeAutoScroll(scrollEl)

const cols = computed(
  () =>
    `minmax(9rem, auto) repeat(${b.platforms.value.length}, minmax(13rem, 1fr)) minmax(0.5rem, auto)`,
)

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
const addBtnEl = ref<HTMLElement | null>(null)
const adding = ref(false)
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
    <div
      ref="gridEl"
      class="grid w-max min-w-full gap-x-2 px-4 pb-16 text-sm"
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
            class="text-primary text-sm font-bold"
          >
            {{ b.platforms.value.length ? 'Edit platforms' : 'Add platforms' }}
          </RouterLink>
        </div>
        <div
          v-for="p in b.platforms.value"
          :key="p.id"
          class="bg-card flex min-h-10 items-center justify-center rounded-lg border px-2 text-center text-[0.9375rem] font-bold"
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

      <p
        v-if="!b.blocks.value.length"
        class="text-muted-foreground col-span-full mb-4 max-w-md px-1 text-[0.9375rem]"
      >
        Start with a session, like Morning, then add its events and drag dances into
        them. Or let autofill make a first draft from the categories, dances and judges.
      </p>
      <div
        v-if="!b.readonly.value"
        class="col-span-full flex flex-wrap items-center gap-2"
      >
        <button
          ref="addBtnEl"
          type="button"
          class="bg-card border-strong hover:bg-accent flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.9375rem] font-bold"
          @click="adding = !adding"
        >
          <Plus class="size-4" /> Add session
        </button>
        <AddPopover
          :anchor="addBtnEl"
          :open="adding"
          :items="suggestions"
          placeholder="Session name…"
          @close="adding = false"
          @select="addBlock($event.label)"
          @add="addBlock"
        />
        <button
          v-if="canAutofill"
          type="button"
          class="text-muted-foreground hover:text-foreground hover:bg-accent flex h-11 items-center gap-1.5 rounded-xl px-3 text-[0.9375rem] font-bold"
          @click="fillSchedule"
        >
          <WandSparkles class="size-4" /> Autofill the schedule
        </button>
      </div>
    </div>
  </div>
</template>
