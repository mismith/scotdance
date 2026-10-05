<script setup lang="ts">
import LogoMark from '@/components/LogoMark.vue'

// A notification as a phone shows it: the app's icon, a bold first line, the
// rest under it, and when. For showing what an alert will look like (asking
// to turn them on, the outbox in System admin), not for sending one.
withDefaults(defineProps<{ title: string; body?: string | null; when?: string }>(), { body: null, when: 'now' })
</script>

<template>
  <div class="bg-card/95 flex items-start gap-3 rounded-[1.375rem] p-3 text-left shadow-lg ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10">
    <span class="bg-primary-fill flex size-9.5 shrink-0 items-center justify-center rounded-[0.625rem]" aria-hidden="true">
      <LogoMark class="size-7 text-white" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex items-baseline gap-2">
        <span class="min-w-0 flex-1 truncate text-[0.9375rem] leading-snug font-semibold">{{ title }}</span>
        <span class="text-muted-foreground shrink-0 text-xs">{{ when }}</span>
      </span>
      <span v-if="body" class="line-clamp-2 block text-[0.9375rem] leading-snug">{{ body }}</span>
    </span>
  </div>
</template>
