<script setup lang="ts">
import { ArrowDownToLine, X } from '@lucide/vue'
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
      class="bg-background relative w-full max-w-sm overflow-hidden rounded-lg border shadow-lg"
    >
      <button
        type="button"
        class="hover:bg-accent text-muted-foreground absolute top-2 right-2 z-10 rounded-md p-1"
        title="Close"
        @click="update.closeDialog()"
      >
        <X class="size-4" />
      </button>

      <div class="flex items-center gap-3 border-b px-6 py-4">
        <h2
          id="update-dialog-title"
          class="font-serif flex-1 text-xl font-medium tracking-tight"
        >
          Update Available
        </h2>
        <ArrowDownToLine class="text-muted-foreground size-5" />
      </div>

      <div class="bg-primary text-primary-foreground space-y-2 px-6 py-6 text-center">
        <p class="text-sm opacity-90">Get the latest version of the app:</p>
        <p class="text-xl font-semibold tabular-nums">
          <span class="opacity-80">{{ update.currentVersion }}</span>
          <span class="mx-2 opacity-60">&rarr;</span>
          <span>{{ update.latestVersion ?? '…' }}</span>
        </p>
      </div>

      <div class="flex justify-end gap-2 px-4 py-3">
        <button
          type="button"
          class="hover:bg-accent text-muted-foreground rounded-md px-3 py-1.5 text-sm"
          @click="update.closeDialog()"
        >
          Later
        </button>
        <button
          type="button"
          class="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium hover:opacity-90"
          @click="update.applyUpdate()"
        >
          Update Now
        </button>
      </div>
    </div>
  </div>
</template>
