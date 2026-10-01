<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical, X } from '@lucide/vue'
import Medal from '@/components/Medal.vue'
import { isPlaceholderId, isTied, placeAt, type Entry, type Placings } from '@/lib/admin/results'
import type { MDancer } from '@/composables/admin/useManagedCompetition'
import { canEdit } from '@/lib/admin/write'

// The placed order for one dance: drag to fix the order, mark ties, take
// someone out, or swap a "?" for the dancer it should have been.

const props = defineProps<{
  placings: Placings
  dancersById: Map<string, MDancer>
  /** Callbacks: no places, ties or order (shown by number). */
  callbacks?: boolean
}>()

const emit = defineEmits<{
  reorder: [entries: Entry[]]
  tie: [index: number, tie: boolean]
  remove: [index: number]
  fix: [index: number]
}>()

const list = ref<Array<Entry & { key: string }>>([])
const dragging = ref(false)
watch(
  () => props.placings.entries,
  (entries) => {
    if (!dragging.value) list.value = entries.map((e, i) => ({ ...e, key: `${e.id}-${i}` }))
  },
  { immediate: true, deep: true },
)

const shown = computed(() =>
  props.callbacks
    ? [...list.value].sort((a, b) => (props.dancersById.get(a.id)?.num ?? '').localeCompare(props.dancersById.get(b.id)?.num ?? '', undefined, { numeric: true }))
    : list.value,
)

function onEnd() {
  dragging.value = false
  emit('reorder', list.value.map(({ id, tie }) => ({ id, tie })))
}

const indexOf = (key: string) => list.value.findIndex((e) => e.key === key)
// The first entry (last, when entering from the lowest place) can't tie with
// the one before it: there isn't one.
const canTie = (key: string) => {
  const i = indexOf(key)
  return i > 0
}
</script>

<template>
  <VueDraggable
    v-model="list"
    tag="ol"
    class="space-y-1.5"
    handle="[data-handle]"
    :disabled="callbacks || !canEdit"
    :animation="150"
    ghost-class="opacity-40"
    @start="dragging = true"
    @end="onEnd"
  >
    <li
      v-for="e in shown"
      :key="e.key"
      class="bg-card flex min-h-13 items-center gap-2 rounded-xl border py-1.5 pr-1.5 pl-1 shadow-xs"
    >
      <span
        v-if="!callbacks"
        data-handle
        class="text-muted-foreground flex w-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        aria-hidden="true"
      >
        <GripVertical class="size-4" />
      </span>
      <Medal v-if="!callbacks" :place="placeAt(indexOf(e.key), placings)" :tied="isTied(indexOf(e.key), placings)" size="sm" />
      <span
        :class="[
          'min-w-10 shrink-0 rounded-md border px-1.5 py-0.5 text-center font-mono text-sm font-semibold tabular-nums',
          isPlaceholderId(e.id) || !dancersById.get(e.id) ? 'bg-next text-next-foreground border-transparent' : 'bg-paper text-paper-ink',
          callbacks && 'ml-1',
        ]"
      >
        {{ isPlaceholderId(e.id) || !dancersById.get(e.id) ? '?' : dancersById.get(e.id)?.num || '–' }}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[0.9375rem] font-semibold">
          {{ dancersById.get(e.id)?.label ?? (isPlaceholderId(e.id) ? 'Unknown dancer' : 'Deleted dancer') }}
        </span>
      </span>
      <button
        v-if="isPlaceholderId(e.id) || !dancersById.get(e.id)"
        type="button"
        :disabled="!canEdit"
        class="bg-next text-next-foreground h-9 shrink-0 rounded-lg px-2.5 text-sm font-bold disabled:opacity-50"
        @click="emit('fix', indexOf(e.key))"
      >
        Choose
      </button>
      <button
        v-if="!callbacks && canTie(e.key)"
        type="button"
        role="switch"
        :aria-checked="e.tie"
        :aria-label="`Tied with the dancer above`"
        :disabled="!canEdit"
        :class="[
          'h-9 shrink-0 rounded-lg border px-2.5 text-sm font-bold disabled:opacity-50',
          e.tie ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-accent',
        ]"
        @click="emit('tie', indexOf(e.key), !e.tie)"
      >
        Tie
      </button>
      <button
        type="button"
        :disabled="!canEdit"
        :aria-label="`Take out ${dancersById.get(e.id)?.label ?? 'this dancer'}`"
        class="text-muted-foreground hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
        @click="emit('remove', indexOf(e.key))"
      >
        <X class="size-4" />
      </button>
    </li>
  </VueDraggable>
</template>
