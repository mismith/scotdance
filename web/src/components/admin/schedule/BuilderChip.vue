<script setup lang="ts">
import { ref } from 'vue'
import { makeDraggable } from '@vue-dnd-kit/core'
import { GripVertical, X } from '@lucide/vue'
import { useBuilder } from './builder'
import { ACTIVATION, payload, useDragHandle, type DragData } from './drag'

// A draggable block: a dance, age group, judge or spacer. Its colour says
// which, everywhere it appears (palette and schedule).

const props = defineProps<{
  kind: 'dance' | 'group' | 'judge' | 'spacer'
  /** What a drop receives. Called when the drag starts. */
  data: () => DragData
  label: string
  /** Full name, when the label is shortened. */
  title?: string
  removable?: boolean
}>()
const emit = defineEmits<{ remove: [] }>()

const b = useBuilder()
const el = ref<HTMLElement | null>(null)
const { isDragging } = makeDraggable(
  el,
  {
    groups: [props.kind === 'spacer' ? 'group' : props.kind],
    activation: ACTIVATION,
    dragHandle: useDragHandle(),
    disabled: b.readonly,
  },
  () => payload(props.data()),
)

const TONE = {
  dance: 'bg-dance/80 text-dance-foreground hover:bg-dance border-dance-foreground/15',
  group: 'bg-group/80 text-group-foreground hover:bg-group border-group-foreground/15',
  judge: 'bg-judge/80 text-judge-foreground hover:bg-judge border-judge-foreground/15',
  spacer:
    'bg-group/10 text-group-foreground/80 dark:text-group hover:bg-group/25 border-dashed border-group-foreground/40 dark:border-group/50',
}
</script>

<template>
  <span
    ref="el"
    :data-chip="kind === 'spacer' ? 'group' : kind"
    :title="title ?? label"
    :class="[
      'group/chip flex min-h-8 min-w-0 cursor-grab items-center rounded-lg border py-1 pr-1 pl-0.5 text-sm leading-tight font-bold select-none active:cursor-grabbing',
      TONE[kind],
      isDragging && 'opacity-40',
    ]"
  >
    <span
      data-grip
      class="flex shrink-0 touch-none items-center self-stretch px-0.5 opacity-50 pointer-coarse:px-1.5"
      aria-hidden="true"
    >
      <GripVertical class="size-3.5" />
    </span>
    <span class="min-w-0 flex-1 truncate"
      ><slot>{{ label }}</slot></span
    >
    <button
      v-if="removable && !b.readonly.value"
      type="button"
      :aria-label="`Remove ${title ?? label}`"
      class="hover:bg-foreground/10 -my-1 ml-1 flex size-6 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/chip:opacity-60 hover:opacity-100! focus-visible:opacity-100 pointer-coarse:opacity-60"
      @click.stop="emit('remove')"
      @pointerdown.stop
    >
      <X class="size-3.5" />
    </button>
  </span>
</template>
