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
  /** Overrides history: jump `delta` entries, or go to `to`. */
  exit?: { delta?: number; to?: RouteLocationRaw; label: string } | null
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
    class="glass press-glass proximity text-primary pointer-events-auto flex h-11 max-w-[42vw] shrink-0 items-center gap-0.5 rounded-full pr-4 pl-2 text-callout font-semibold [view-transition-name:nav-back]"
    :aria-label="`Back to ${label}`"
    @click="onClick"
  >
    <ChevronLeft class="size-5 shrink-0" stroke-width="2.5" />
    <span class="truncate">{{ label }}</span>
  </button>
</template>
