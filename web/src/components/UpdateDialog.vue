<script setup lang="ts">
import { useUpdate } from '@/composables/useUpdate'

const update = useUpdate()
</script>

<template>
  <div
    v-if="update.dialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="update-dialog-title"
    @click.self="update.closeDialog()"
  >
    <div
      class="bg-background relative w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-lg"
    >
      <h2
        id="update-dialog-title"
        class="font-serif text-xl font-medium tracking-tight"
      >
        Update available
      </h2>
      <p class="text-muted-foreground text-sm">
        A newer version of the app is ready to install.
      </p>
      <div
        class="text-muted-foreground flex items-baseline justify-center gap-2 text-sm tabular-nums"
      >
        <span>{{ update.currentVersion }}</span>
        <span aria-hidden="true">→</span>
        <span class="text-foreground font-medium">
          {{ update.latestVersion ?? '…' }}
        </span>
      </div>
      <div class="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          class="hover:bg-accent text-muted-foreground rounded-md px-3 py-2 text-sm"
          @click="update.closeDialog()"
        >
          Later
        </button>
        <button
          type="button"
          class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
          @click="update.applyUpdate()"
        >
          Update now
        </button>
      </div>
    </div>
  </div>
</template>
