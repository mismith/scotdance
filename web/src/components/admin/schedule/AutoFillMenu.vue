<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { WandSparkles } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'
import { ordered, useBuilder } from './builder'
import { useAutoFill } from './autofill'
import { toast } from '@/lib/admin/feedback'

// Autofill for one event: place dances, then share out age groups and judges.

const props = defineProps<{ blockId: string; eventId: string }>()

const b = useBuilder()
const auto = useAutoFill()
const menu = useMorph()
// Opened, the keyboard goes to its first item (the menu opens down the page).
const listEl = ref<HTMLElement | null>(null)
watch(
  () => menu.open,
  async (open) => {
    if (!open) return
    await nextTick()
    listEl.value?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
  },
  { flush: 'post' },
)

const hasRows = computed(() =>
  ordered(b.getEvent(props.blockId, props.eventId)?.dances).some(([, r]) => r.danceId),
)
const groupsHint = computed(() =>
  !hasRows.value
    ? 'Place some dances first'
    : !b.platforms.value.length
      ? 'Add platforms first'
      : !b.m.groups.value.length
        ? 'Add age groups first'
        : '',
)
const judgesHint = computed(() =>
  !hasRows.value
    ? 'Place some dances first'
    : !b.platforms.value.length
      ? 'Add platforms first'
      : !b.judges.value.length
        ? 'Add judges first'
        : '',
)

async function run(label: string, fn: () => Promise<number | null>) {
  void menu.hide()
  const change = await fn()
  if (change != null)
    toast(label, { action: { label: 'Undo', run: () => b.m.undoChange(change) } })
}

// The one menu anatomy: inset rounded rows, medium labels.
const row =
  'press-row focus-inset flex min-h-11 w-full flex-col justify-center rounded-xl px-3 py-1.5 text-left text-base font-medium disabled:opacity-(--disabled-opacity)'
</script>

<template>
  <button
    v-if="b.dances.value.length"
    type="button"
    aria-label="Autofill"
    title="Autofill"
    aria-haspopup="dialog"
    :aria-expanded="menu.open"
    class="press text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-full"
    @click="menu.toggle($event)"
    @pointerdown.stop
    @keydown.enter.stop
    @keydown.space.stop
  >
    <WandSparkles class="size-4" />
  </button>
  <Dialog :open="menu.open" :morph="menu" variant="dropdown" aria-label="Autofill" @close="menu.hide()">
    <div ref="listEl" role="menu" aria-label="Autofill" class="[&>div+div]:mt-1.5 [&>div+div]:border-t [&>div+div]:pt-1.5">
      <div>
        <button
          v-for="c in b.categories.value"
          :key="c.id"
          type="button"
          role="menuitem"
          :class="row"
          @click="run(`Placed ${c.label} dances`, () => auto.placeDances(blockId, eventId, new Set([c.id])))"
        >
          Place {{ c.label }} dances
        </button>
        <button type="button" role="menuitem" :class="row" @click="run('Placed all dances', () => auto.placeDances(blockId, eventId))">
          Place all dances
        </button>
      </div>
      <div>
        <button
          type="button"
          role="menuitem"
          :disabled="!!groupsHint"
          :title="groupsHint || 'Shares each dance’s age groups across the platforms, replacing any there'"
          :class="row"
          @click="run('Assigned age groups', () => auto.fillGroups(blockId, eventId))"
        >
          Assign age groups
          <span v-if="groupsHint" class="text-muted-foreground text-sm font-normal">{{ groupsHint }}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          :disabled="!!judgesHint"
          :title="judgesHint || 'One judge per platform, rotating each dance, replacing any there'"
          :class="row"
          @click="run('Assigned judges', () => auto.cycleJudges(blockId, eventId))"
        >
          Assign judges
          <span v-if="judgesHint" class="text-muted-foreground text-sm font-normal">{{ judgesHint }}</span>
        </button>
      </div>
    </div>
  </Dialog>
</template>
