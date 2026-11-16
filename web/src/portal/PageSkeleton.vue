<script setup lang="ts">
defineProps<{ account: boolean }>()
</script>
<template>
  <section role="status" aria-label="Loading your account" aria-busy="true">
    <span class="sr-only">Loading your account…</span>
    <div aria-hidden="true" class="motion-safe:animate-pulse">
      <template v-if="account">
        <div class="space-y-5 py-3">
          <div class="space-y-2">
            <div class="flex items-end gap-4">
              <div class="size-16 shrink-0 rounded-full bg-muted" />
              <div class="min-w-0 flex-1 space-y-1.5">
                <div class="h-5 w-20 rounded bg-muted" />
                <div class="h-12 rounded-xl bg-muted" />
              </div>
            </div>
            <div class="h-5 w-60 max-w-full rounded bg-muted" />
          </div>
          <div>
            <div class="flex h-14 items-center justify-between"><div class="space-y-2"><div class="h-4 w-12 rounded bg-muted" /><div class="h-4 w-48 rounded bg-muted" /></div><div class="h-5 w-14 rounded bg-muted" /></div>
            <div class="flex h-14 items-center justify-between"><div class="h-5 w-20 rounded bg-muted" /><div class="h-5 w-14 rounded bg-muted" /></div>
          </div>
          <div class="h-12 w-36 rounded-full bg-muted" />
        </div>
      </template>
      <template v-else>
        <div class="mb-6 h-10 w-36 rounded bg-muted" />
        <div v-for="n in 3" :key="n" class="flex h-20 items-center gap-3">
          <div class="size-11 shrink-0 rounded-full bg-muted" />
          <div class="space-y-2"><div class="h-5 w-40 rounded bg-muted" /><div class="h-4 w-28 rounded bg-muted" /></div>
        </div>
      </template>
    </div>
  </section>
</template>
