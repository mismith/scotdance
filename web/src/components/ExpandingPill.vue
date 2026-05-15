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

// Measure the compact pill relative to the overlay host (the row), not
// its own offsetParent. The overlay is teleported up to the row so its
// coordinate space is the row, not the outer pill — keep clip-path math
// in the same frame so the morph still emerges from the compact slot.
function applyPillRect(el: Element) {
  const c = compactRef.value
  if (!c) return
  const target = el as HTMLElement
  const host = target.parentElement
  if (!host) return
  const cRect = c.getBoundingClientRect()
  const hRect = host.getBoundingClientRect()
  target.style.setProperty('--pill-x', `${cRect.left - hRect.left}px`)
  target.style.setProperty('--pill-y', `${cRect.top - hRect.top}px`)
  target.style.setProperty('--pill-w', `${cRect.width}px`)
  target.style.setProperty('--pill-h', `${cRect.height}px`)
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
      'bg-card-foreground/10 hover:bg-card-foreground/15 pointer-events-auto inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 font-sans text-sm font-medium whitespace-nowrap transition-colors',
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
    enter-active-class="transition ease-rubber-band"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-out"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-40" aria-hidden="true" @click="close" />
  </Transition>

  <!-- Expanded overlay + X cancel are teleported up to the row so they
       can extend wider than the outer pill (which is now a containing
       block due to its backdrop-filter) and anchor to the full row width. -->
  <Teleport to="[data-pill-overlay-host]" defer>
    <Transition
      enter-active-class="transition-all ease-rubber-band"
      enter-from-class="[clip-path:inset(var(--pill-y,4px)_calc(100%-var(--pill-x,0px)-var(--pill-w,0px))_calc(100%-var(--pill-y,4px)-var(--pill-h,2.5rem))_var(--pill-x,0px)_round_1.5rem)]"
      enter-to-class="[clip-path:inset(0_0_0_0_round_1.5rem)]"
      leave-active-class="transition-all ease-out"
      leave-from-class="[clip-path:inset(0_0_0_0_round_1.5rem)]"
      leave-to-class="[clip-path:inset(var(--pill-y,4px)_calc(100%-var(--pill-x,0px)-var(--pill-w,0px))_calc(100%-var(--pill-y,4px)-var(--pill-h,2.5rem))_var(--pill-x,0px)_round_1.5rem)]"
      @before-enter="applyPillRect"
      @before-leave="applyPillRect"
    >
      <div v-if="isOpen" class="absolute top-0 right-14 left-0 z-50">
        <div class="floating-nav min-h-12 w-full overflow-x-auto rounded-3xl">
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
        class="floating-nav pointer-events-auto absolute top-0 right-0 z-60 flex size-12 items-center justify-center rounded-full hover:opacity-90"
        aria-label="Close"
        @click="close"
      >
        <X class="size-5" />
      </button>
    </Transition>
  </Teleport>
</template>
