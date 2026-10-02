<script setup lang="ts">
import { useUpdate } from '@/composables/useUpdate'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'

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
      <Button variant="primary" size="lg" block @click="update.applyUpdate()">Update now</Button>
      <Button variant="plain" size="lg" block @click="update.closeDialog()">Later</Button>
    </div>
  </Dialog>
</template>
