<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { onKeyStroke } from '@vueuse/core'
import { WandSparkles } from '@lucide/vue'
import { ordered, useBuilder } from './builder'
import { useAutoFill } from './autofill'
import { toast } from '@/lib/admin/feedback'

// Autofill for one event: place dances, then share out age groups and judges.

const props = defineProps<{ blockId: string; eventId: string }>()

const b = useBuilder()
const auto = useAutoFill()
const open = ref(false)
const btnEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const { floatingStyles } = useFloating(btnEl, menuEl, {
  placement: 'bottom-end',
  middleware: [offset(4), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})
onKeyStroke('Escape', () => {
  if (!open.value) return
  open.value = false
  btnEl.value?.focus()
})
// The menu opens at the end of the page: take the keyboard to it.
watch(menuEl, (el) => el?.querySelector<HTMLElement>('button:not(:disabled)')?.focus())

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
  open.value = false
  btnEl.value?.focus()
  const change = await fn()
  if (change != null)
    toast(label, { action: { label: 'Undo', run: () => b.m.undoChange(change) } })
}
</script>

<template>
  <button
    v-if="b.dances.value.length"
    ref="btnEl"
    type="button"
    aria-label="Autofill"
    title="Autofill"
    :aria-expanded="open"
    class="text-muted-foreground hover:text-foreground hover:bg-card flex size-11 items-center justify-center rounded-full"
    @click="open = !open"
    @pointerdown.stop
    @keydown.enter.stop
    @keydown.space.stop
  >
    <WandSparkles class="size-4" />
  </button>
  <Teleport to="body">
    <template v-if="open">
      <div class="fixed inset-0 z-40" @click="open = false" />
      <div
        ref="menuEl"
        role="menu"
        class="bg-popover text-popover-foreground z-50 max-w-[calc(100vw-1rem)] min-w-52 rounded-xl border p-1 text-base font-normal shadow-lg"
        :style="floatingStyles"
      >
        <button
          v-for="c in b.categories.value"
          :key="c.id"
          type="button"
          role="menuitem"
          class="hover:bg-accent flex min-h-11 w-full items-center rounded-lg px-3 py-1.5 text-left"
          @click="
            run(`Placed ${c.label} dances`, () =>
              auto.placeDances(blockId, eventId, new Set([c.id])),
            )
          "
        >
          Place {{ c.label }} dances
        </button>
        <button
          type="button"
          role="menuitem"
          class="hover:bg-accent flex min-h-11 w-full items-center rounded-lg px-3 py-1.5 text-left"
          @click="run('Placed all dances', () => auto.placeDances(blockId, eventId))"
        >
          Place all dances
        </button>
        <div class="my-1 border-t" />
        <button
          type="button"
          role="menuitem"
          :disabled="!!groupsHint"
          :title="
            groupsHint ||
            'Shares each dance’s age groups across the platforms, replacing any there'
          "
          class="hover:bg-accent flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-1.5 text-left disabled:opacity-50 disabled:hover:bg-transparent"
          @click="run('Assigned age groups', () => auto.fillGroups(blockId, eventId))"
        >
          Assign age groups
          <span v-if="groupsHint" class="text-muted-foreground text-xs">{{
            groupsHint
          }}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          :disabled="!!judgesHint"
          :title="
            judgesHint ||
            'One judge per platform, rotating each dance, replacing any there'
          "
          class="hover:bg-accent flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-1.5 text-left disabled:opacity-50 disabled:hover:bg-transparent"
          @click="run('Assigned judges', () => auto.cycleJudges(blockId, eventId))"
        >
          Assign judges
          <span v-if="judgesHint" class="text-muted-foreground text-xs">{{
            judgesHint
          }}</span>
        </button>
      </div>
    </template>
  </Teleport>
</template>
