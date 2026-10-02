<script setup lang="ts">
import { ref } from 'vue'
import { makeDraggable } from '@vue-dnd-kit/core'
import { GripVertical, X } from '@lucide/vue'
import { useBuilder } from './builder'
import { ACTIVATION, payload, useDragHandle, type DragData } from './drag'

// A draggable block: a dance, age group, judge or spacer. The colour of the
// bar down its side says which, everywhere it appears (palette and schedule).
// With a mouse the whole chip drags, so its grip only shows on hover; on a
// touch screen it drags by the grip, which always shows.

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

const BAR = {
  dance: 'bg-dance',
  group: 'bg-group',
  judge: 'bg-judge',
  spacer: 'bg-group/40',
}
</script>

<template>
  <span
    ref="el"
    :data-chip="kind === 'spacer' ? 'group' : kind"
    :title="title ?? label"
    :class="[
      'group/chip has-[[data-grip]:focus-visible]:ring-ring hover:bg-accent flex min-h-8 min-w-0 cursor-grab items-center gap-0.5 rounded-lg py-1 pr-1 pl-1 text-sm leading-tight font-medium select-none active:cursor-grabbing has-[[data-grip]:focus-visible]:ring-2',
      kind === 'spacer'
        ? 'text-muted-foreground border-strong border border-dashed'
        : 'surface',
      isDragging && 'opacity-40',
    ]"
  >
    <span
      :class="['w-1 shrink-0 self-stretch rounded-full', BAR[kind]]"
      aria-hidden="true"
    />
    <!-- Focus the grip and press Enter or Space to move it with the arrow keys. -->
    <span
      data-grip
      :tabindex="b.readonly.value ? undefined : 0"
      :role="b.readonly.value ? undefined : 'button'"
      :aria-label="b.readonly.value ? undefined : `Move ${title ?? label}`"
      :aria-hidden="b.readonly.value || undefined"
      class="text-muted-foreground flex shrink-0 touch-none items-center self-stretch px-0.5 outline-none pointer-coarse:px-1.5 pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover/chip:opacity-100 pointer-fine:focus-visible:opacity-100"
    >
      <GripVertical class="size-3.5" />
    </span>
    <span class="min-w-0 flex-1 truncate"
      ><slot>{{ label }}</slot></span
    >
    <!-- Like a tag in a field, its remove button is field-sized. -->
    <button
      v-if="removable && !b.readonly.value"
      type="button"
      :aria-label="`Remove ${title ?? label}`"
      class="text-muted-foreground hover:text-foreground hover:bg-foreground/10 -my-1 ml-0.5 flex size-7 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/chip:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
      @click.stop="emit('remove')"
      @pointerdown.stop
      @keydown.enter.stop
      @keydown.space.stop
    >
      <X class="size-3.5" />
    </button>
  </span>
</template>
