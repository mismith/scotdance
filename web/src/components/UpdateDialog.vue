<script setup lang="ts">
import { ArrowDownToLine, X } from 'lucide-vue-next';
import { useUpdate } from '@/composables/useUpdate';

const update = useUpdate();
</script>

<template>
  <div
    v-if="update.dialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="update-dialog-title"
    @click.self="update.closeDialog()"
  >
    <div class="relative w-full max-w-sm bg-background border rounded-lg shadow-lg overflow-hidden">
      <button
        type="button"
        class="absolute top-2 right-2 z-10 p-1 rounded-md hover:bg-accent text-muted-foreground"
        title="Close"
        @click="update.closeDialog()"
      >
        <X class="size-4" />
      </button>

      <div class="px-6 py-4 flex items-center gap-3 border-b">
        <h2 id="update-dialog-title" class="flex-1 text-lg font-semibold">Update Available</h2>
        <ArrowDownToLine class="size-5 text-muted-foreground" />
      </div>

      <div class="px-6 py-6 bg-primary text-primary-foreground text-center space-y-2">
        <p class="text-sm opacity-90">Get the latest version of the app:</p>
        <p class="text-xl font-semibold tabular-nums">
          <span class="opacity-80">{{ update.currentVersion }}</span>
          <span class="mx-2 opacity-60">&rarr;</span>
          <span>{{ update.latestVersion ?? '…' }}</span>
        </p>
      </div>

      <div class="px-4 py-3 flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded-md text-sm hover:bg-accent text-muted-foreground"
          @click="update.closeDialog()"
        >
          Later
        </button>
        <button
          type="button"
          class="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          @click="update.applyUpdate()"
        >
          Update Now
        </button>
      </div>
    </div>
  </div>
</template>
