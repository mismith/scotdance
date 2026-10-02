<script setup lang="ts">
import { useUpdate } from '@/composables/useUpdate'
import Dialog from '@/components/Dialog.vue'

const update = useUpdate()
</script>

<template>
  <Dialog :open="update.dialogOpen" variant="sheet" @close="update.closeDialog()">
    <template #header>
      <h2 class="text-title">A new version is ready</h2>
    </template>
    <div class="space-y-3 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <p class="text-base">
        Update to get the latest fixes. It only takes a moment, and you’ll stay signed in.
      </p>
      <p class="text-muted-foreground text-sm tabular-nums">
        Version {{ update.currentVersion }} → {{ update.latestVersion ?? '…' }}
      </p>
      <button type="button" class="bg-primary-fill text-primary-foreground h-12 w-full rounded-xl text-base font-bold" @click="update.applyUpdate()">
        Update now
      </button>
      <button type="button" class="text-muted-foreground h-11 w-full font-bold" @click="update.closeDialog()">Later</button>
    </div>
  </Dialog>
</template>
