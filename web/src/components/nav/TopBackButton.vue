<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'
import { backPath, goUp, useCanGoBack } from '@/lib/back'
import { backLabelFor } from '@/lib/backLabels'

// Labelled Back: says where it goes. When there's no in-app history (a deep
// link, a cold start), it falls back to `fallback` so a parent opening a
// shared results link still has a way out.
const props = defineProps<{
  fallback?: { to: RouteLocationRaw; label: string }
  /**
   * Overrides history: jump `delta` entries, or go to `to`. `compact` shows
   * just the chevron (a competition's tabs, where the tab bar's own way out
   * is right there), so the title keeps the room.
   */
  exit?: { delta?: number; to?: RouteLocationRaw; label: string; compact?: boolean } | null
}>()

const route = useRoute()
const router = useRouter()
const canGoBack = useCanGoBack()

const label = computed(() => {
  void route.fullPath
  if (props.exit) return props.exit.label
  if (canGoBack.value) return backLabelFor(backPath())
  return props.fallback?.label ?? 'Back'
})

const visible = computed(() => !!props.exit || canGoBack.value || !!props.fallback)

function onClick(event: MouseEvent) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (props.exit?.delta) router.go(props.exit.delta)
  else if (props.exit?.to) goUp(router, props.exit.to)
  else if (canGoBack.value) router.back()
  else if (props.fallback) goUp(router, props.fallback.to)
}
</script>

<template>
  <button
    v-if="visible"
    v-tap-feedback
    v-proximity
    type="button"
    data-nav="back"
    data-bar="back"
    :class="[
      'glass press-glass proximity text-primary pointer-events-auto flex h-11 shrink-0 items-center rounded-full [view-transition-name:nav-back]',
      // With big text on a phone the label would crowd out the bar's actions
      // (the query is in rem, so it scales with the text): just the arrow.
      exit?.compact
        ? 'w-11 justify-center'
        : 'text-callout max-w-[42vw] gap-0.5 pr-4 pl-2 font-semibold @max-[22rem]:w-11 @max-[22rem]:justify-center @max-[22rem]:px-0',
    ]"
    :aria-label="`Back to ${label}`"
    @click="onClick"
  >
    <ChevronLeft :class="['shrink-0', exit?.compact ? 'size-6 -translate-x-px' : 'size-5']" stroke-width="2.5" />
    <span v-if="!exit?.compact" class="truncate @max-[22rem]:hidden">{{ label }}</span>
  </button>
</template>
