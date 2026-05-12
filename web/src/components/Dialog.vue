<script setup lang="ts">
import { nextTick, onMounted, ref, useSlots, watch } from 'vue'
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    variant?: 'center' | 'sheet'
    size?: 'sm' | 'md'
    closable?: boolean
  }>(),
  { variant: 'center', size: 'sm', closable: true },
)

const emit = defineEmits<{ close: [] }>()
const slots = useSlots()

const dialogRef = ref<HTMLDialogElement | null>(null)

function sync(open: boolean) {
  const el = dialogRef.value
  if (!el) return
  if (open && !el.open) el.showModal()
  else if (!open && el.open) el.close()
}

watch(
  () => props.open,
  (open) => {
    nextTick(() => sync(open))
  },
)

onMounted(() => {
  if (props.open) sync(true)
})

function onBackdropClick(e: MouseEvent) {
  if (e.target === dialogRef.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialogRef"
    :class="[
      'inset-0 m-0 h-full max-h-full w-full max-w-full overflow-hidden border-0 bg-transparent p-0 text-inherit',
      'open:flex',
      'transition-[display,overlay] transition-discrete',
      'backdrop:bg-black/0 open:backdrop:bg-black/50',
      'backdrop:transition-[background-color,display,overlay] backdrop:transition-discrete',
      'starting:open:backdrop:bg-black/0',
      '*:opacity-0 open:*:opacity-100',
      '*:transition-[opacity,scale,translate] *:ease-[cubic-bezier(0.34,1.3,0.64,1)]',
      variant === 'center' &&
        'items-center justify-center p-4 *:scale-[0.96] open:*:scale-100 starting:open:*:scale-[0.96] starting:open:*:opacity-0',
      variant === 'sheet' &&
        'items-end justify-center sm:items-center sm:p-4 max-sm:*:translate-y-full sm:*:translate-y-6 open:*:translate-y-0 max-sm:starting:open:*:translate-y-full sm:starting:open:*:translate-y-6 starting:open:*:opacity-0',
      'motion-reduce:transition-none motion-reduce:backdrop:transition-none motion-reduce:*:transition-none',
    ]"
    @close="emit('close')"
    @click="onBackdropClick"
  >
    <div
      :class="[
        'bg-background relative w-full border',
        size === 'sm' ? 'max-w-sm' : 'max-w-md',
        variant === 'center'
          ? 'space-y-4 rounded-lg p-6 shadow-lg'
          : 'flex max-h-[85svh] flex-col rounded-t-2xl sm:rounded-2xl',
      ]"
    >
      <header
        v-if="variant === 'sheet' && slots.header"
        class="flex items-start gap-3 border-b p-4 pr-2"
      >
        <div class="min-w-0 flex-1 space-y-1">
          <slot name="header" />
        </div>
        <button
          v-if="closable"
          type="button"
          title="Close"
          class="hover:bg-accent text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
          @click="emit('close')"
        >
          <X class="size-4" />
        </button>
      </header>

      <button
        v-if="closable && !(variant === 'sheet' && slots.header)"
        type="button"
        title="Close"
        class="hover:bg-accent text-muted-foreground absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>

      <div v-if="variant === 'sheet'" class="overflow-y-auto">
        <slot />
      </div>
      <slot v-else />
    </div>
  </dialog>
</template>
