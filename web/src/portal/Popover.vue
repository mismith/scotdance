<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{ open: boolean; title: string; width?: number }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const anchor = ref<HTMLElement>()
const panel = ref<HTMLElement>()
let observer: ResizeObserver | undefined
watch(panel, el => { observer?.disconnect(); if (el) { observer = new ResizeObserver(place); observer.observe(el) } })
function close() { emit('update:open', false) }
function place() {
  const a = anchor.value?.getBoundingClientRect(), p = panel.value
  if (!a || !p) return
  const width = Math.min(props.width ?? 332, innerWidth - 16)
  p.style.width = `${width}px`
  p.style.maxHeight = `${Math.max(160, innerHeight - 32)}px`
  p.style.left = `${Math.max(8, Math.min(a.left, innerWidth - width - 8))}px`
  const h = p.getBoundingClientRect().height
  p.style.top = `${Math.max(8, a.bottom + h + 8 < innerHeight ? a.bottom + 8 : a.top - h - 8)}px`
}
watch(() => props.open, async open => {
  await nextTick()
  if (open) { panel.value?.showPopover(); place() }
  else anchor.value?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
})
function outside(e: PointerEvent) {
  if (props.open && !anchor.value?.contains(e.target as Node) && !panel.value?.contains(e.target as Node)) close()
}
function escape(e: KeyboardEvent) { if (props.open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } }
onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('resize', place); document.addEventListener('scroll', place, true) })
onBeforeUnmount(() => { observer?.disconnect(); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true) })
</script>
<template>
  <div ref="anchor" @click="emit('update:open', !open)"><slot name="anchor" /></div>
  <div v-if="open" ref="panel" popover="manual" role="dialog" :aria-label="title" class="birthday-popover" @keydown="escape"><slot /></div>
</template>
<style scoped>
.birthday-popover { position: fixed; inset: auto; margin: 0; padding: 14px; overflow: auto; background: var(--background); color: var(--foreground); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 12px 40px #0005; }
</style>
