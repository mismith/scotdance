<script setup lang="ts">
import { useUpdate } from '@/composables/useUpdate'
import Dialog from '@/components/Dialog.vue'

const update = useUpdate()
</script>

<template>
  <Dialog
    :open="update.dialogOpen"
    :closable="false"
    @close="update.closeDialog()"
  >
    <h2 class="text-3xl font-medium tracking-tight">
      Update available
    </h2>
    <p class="text-muted-foreground text-lg">
      A newer version of the app is ready to install.
    </p>
    <div
      class="text-muted-foreground flex items-baseline justify-center gap-2 text-lg tabular-nums"
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
        class="hover:bg-accent text-muted-foreground rounded-md px-3 py-1.5 text-sm"
        @click="update.closeDialog()"
      >
        Later
      </button>
      <button
        type="button"
        class="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
        @click="update.applyUpdate()"
      >
        Update now
      </button>
    </div>
  </Dialog>
</template>
