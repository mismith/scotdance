<script setup lang="ts">
import { Check, CircleAlert, CloudOff, LoaderCircle } from '@lucide/vue'
import { useSaveStatus } from '@/composables/admin/useSaveStatus'

// The save state on its own (System admin's bar): words that open out when
// there's something to say, and fold away again (composables/admin/useSaveStatus).
const { state, label, shown, error } = useSaveStatus()
</script>

<template>
  <span role="status" aria-live="polite" :title="state === 'error' ? (error ?? undefined) : undefined" class="inline-flex shrink-0">
    <span
      :class="[
        'grid transition-[grid-template-columns,opacity] duration-(--dur-base) ease-snappy motion-reduce:transition-opacity',
        shown ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0',
      ]"
    >
      <span
        :class="[
          'inline-flex h-9 min-w-0 items-center gap-1.5 overflow-hidden rounded-full px-2 text-sm font-semibold whitespace-nowrap sm:px-3',
          state === 'offline' || state === 'error' ? 'bg-destructive/10 text-destructive' : state === 'saved' ? 'text-done-foreground' : 'text-muted-foreground',
        ]"
      >
        <CloudOff v-if="state === 'offline'" class="size-4 shrink-0" aria-hidden="true" />
        <LoaderCircle v-else-if="state === 'saving'" class="size-4 shrink-0 animate-spin" aria-hidden="true" />
        <CircleAlert v-else-if="state === 'error'" class="size-4 shrink-0" aria-hidden="true" />
        <Check v-else class="size-4 shrink-0" stroke-width="2.75" aria-hidden="true" />
        {{ label }}
      </span>
    </span>
  </span>
</template>
