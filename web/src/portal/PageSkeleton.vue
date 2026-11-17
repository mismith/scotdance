<script setup lang="ts">
defineProps<{ account: boolean }>()
</script>
<template>
  <section
    role="status"
    :aria-label="account ? 'Loading your account' : 'Loading dancers'"
    aria-busy="true"
  >
    <span class="sr-only">{{
      account ? 'Loading your account' : 'Loading dancers'
    }}</span>
    <div aria-hidden="true" class="motion-safe:animate-pulse">
      <template v-if="account">
        <div class="min-h-72 space-y-8 py-3">
          <div class="flex items-center gap-4">
            <div class="bg-muted size-16 shrink-0 rounded-full" />
            <div class="bg-muted h-8 w-1/2 rounded" />
          </div>
          <div class="space-y-6">
            <div class="bg-muted h-4 w-2/3 rounded" />
            <div class="bg-muted h-4 w-1/2 rounded" />
          </div>
        </div>
      </template>
      <template v-else>
        <div v-for="n in 3" :key="n" class="flex h-20 items-center gap-3">
          <div class="bg-muted size-11 shrink-0 rounded-full" />
          <div class="space-y-2">
            <div class="bg-muted h-5 w-40 rounded" />
            <div class="bg-muted h-4 w-28 rounded" />
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
