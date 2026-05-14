<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { X } from '@lucide/vue'
import { useExpandedPill } from '@/composables/useExpandedPill'

const props = defineProps<{
  id: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'close'): void
}>()

const { isOpen, anyOpen, open, close, toggle } = useExpandedPill(props.id)

const compactRef = useTemplateRef<HTMLElement>('compact')

onKeyStroke('Escape', () => {
  if (isOpen.value) close()
})

watch(isOpen, (v) => {
  if (v) emit('open')
  else emit('close')
})

// Measure the compact pill's slot in the row so the overlay can morph
// out of (and back into) that exact position with clip-path. Runs on
// both enter and leave so the leave clip targets wherever the pill
// currently lives.
function applyPillRect(el: Element) {
  const c = compactRef.value
  if (!c) return
  const target = el as HTMLElement
  target.style.setProperty('--pill-x', `${c.offsetLeft}px`)
  target.style.setProperty('--pill-w', `${c.offsetWidth}px`)
}

defineExpose({ open, close })
</script>

<template>
  <!-- Compact form. Fades out (slot preserved) when this pill or a sibling
         is open so the overlay can morph out of its position. -->
  <button
    ref="compact"
    type="button"
    :class="[
      'bg-nav/90 text-nav-foreground pointer-events-auto inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 font-sans text-sm font-medium whitespace-nowrap shadow-lg backdrop-blur-xl transition-opacity hover:opacity-90',
      anyOpen ? 'pointer-events-none opacity-0' : '',
    ]"
    :aria-label="ariaLabel"
    :aria-expanded="isOpen"
    @click="toggle"
  >
    <slot name="compact" />
  </button>

  <!-- Backdrop: invisible click absorber so an "outside click" closes the
         pill instead of activating links/map/list rows below. -->
  <Transition
    enter-active-class="transition ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-out"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-40" aria-hidden="true" @click="close" />
  </Transition>

  <!-- Expanded overlay: morphs out of the compact pill's slot via clip-path.
       --pill-x and --pill-w are set on the element by applyPillRect. -->
  <Transition
    enter-active-class="transition-all ease-rubber-band"
    enter-from-class="[clip-path:inset(4px_calc(100%-var(--pill-x,0px)-var(--pill-w,0px))_4px_var(--pill-x,0px)_round_1.5rem)]"
    enter-to-class="[clip-path:inset(0_0_0_0_round_1.5rem)]"
    leave-active-class="transition-all ease-out"
    leave-from-class="[clip-path:inset(0_0_0_0_round_1.5rem)]"
    leave-to-class="[clip-path:inset(4px_calc(100%-var(--pill-x,0px)-var(--pill-w,0px))_4px_var(--pill-x,0px)_round_1.5rem)]"
    @before-enter="applyPillRect"
    @before-leave="applyPillRect"
  >
    <div v-if="isOpen" class="absolute top-0 right-14 left-0 z-50">
      <div
        class="bg-nav/90 text-nav-foreground min-h-12 w-full overflow-x-auto rounded-3xl border border-white/10 shadow-lg backdrop-blur-xl"
      >
        <slot name="expanded" :close="close" />
      </div>
    </div>
  </Transition>

  <!-- X cancel button: lives where the avatar normally sits. -->
  <Transition
    enter-active-class="transition-all delay-75 ease-rubber-band"
    enter-from-class="opacity-0 scale-50"
    leave-active-class="transition-all ease-out"
    leave-to-class="opacity-0 scale-50"
  >
    <button
      v-if="isOpen"
      type="button"
      class="bg-nav/90 text-nav-foreground pointer-events-auto absolute top-0 right-0 z-60 flex size-12 items-center justify-center rounded-full shadow-lg backdrop-blur-xl hover:opacity-90"
      aria-label="Close"
      @click="close"
    >
      <X class="size-5" />
    </button>
  </Transition>
</template>
