<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
import { Info } from '@lucide/vue'

// A small (i) that explains something in place. Tap or click to open; tap
// anywhere else or press Escape to close (the browser's popover handles both).

defineProps<{ label?: string }>()

const id = useId()
const button = ref<HTMLButtonElement | null>(null)
const pop = ref<HTMLElement | null>(null)

// Sit under the button, kept inside the screen.
async function place() {
  await nextTick()
  const b = button.value?.getBoundingClientRect()
  const p = pop.value
  if (!b || !p) return
  const width = p.offsetWidth
  const left = Math.min(Math.max(12, b.left + b.width / 2 - width / 2), window.innerWidth - width - 12)
  const below = b.bottom + 8
  const top = below + p.offsetHeight > window.innerHeight - 12 ? Math.max(12, b.top - p.offsetHeight - 8) : below
  p.style.left = `${left}px`
  p.style.top = `${top}px`
}
</script>

<template>
  <button
    ref="button"
    type="button"
    :popovertarget="id"
    :aria-label="label ?? 'More about this'"
    class="text-next-foreground bg-next inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle"
    @click.stop
  >
    <Info class="size-3.5" stroke-width="2.5" />
  </button>
  <div
    :id="id"
    ref="pop"
    popover="auto"
    class="bg-foreground text-background fixed inset-auto m-0 h-fit w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl p-3.5 text-left text-sm leading-snug font-medium shadow-xl"
    @toggle="(e: Event) => (e as ToggleEvent).newState === 'open' && place()"
  >
    <slot />
  </div>
</template>
