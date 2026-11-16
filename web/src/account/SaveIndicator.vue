<script setup lang="ts">
import { Check, LoaderCircle } from '@lucide/vue'
import type { SaveStatus } from './save-feedback'
defineProps<{ status?: SaveStatus }>()
</script>
<template>
  <span class="pointer-events-none absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center" role="status">
    <LoaderCircle v-if="status === 'saving'" class="size-4 animate-spin text-primary" aria-hidden="true" />
    <Check v-else-if="status === 'saved'" class="size-4 text-green-500" aria-hidden="true" />
    <span class="sr-only">{{ status === 'saving' ? 'Saving' : status === 'saved' ? 'Saved' : '' }}</span>
  </span>
</template>
