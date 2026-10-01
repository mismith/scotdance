<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { confirmRequest, dismissToast, toasts } from '@/lib/admin/feedback'

const req = computed(() => confirmRequest.value)

async function runAction(id: number, run: () => unknown) {
  dismissToast(id)
  await run()
}
</script>

<template>
  <Dialog :open="!!req" variant="center" :closable="false" @close="req?.resolve(false)">
    <template v-if="req">
      <div class="space-y-2 pr-2">
        <h2 class="text-title">{{ req.title }}</h2>
        <p v-if="req.message" class="text-muted-foreground text-base">{{ req.message }}</p>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="bg-card border-strong hover:bg-accent h-12 rounded-xl border px-5 text-base font-bold"
          @click="req.resolve(false)"
        >
          {{ req.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          type="button"
          :class="[
            'h-12 rounded-xl px-5 text-base font-bold',
            req.destructive ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground',
          ]"
          @click="req.resolve(true)"
        >
          {{ req.confirmLabel }}
        </button>
      </div>
    </template>
  </Dialog>

  <div
    class="pointer-events-none fixed inset-x-4 bottom-[calc(var(--safe-bottom)+1rem+var(--toast-lift,0px))] z-50 flex flex-col items-center gap-2 transition-[bottom]"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-300 ease-rubber-band motion-reduce:transition-none"
      enter-from-class="translate-y-4 opacity-0"
      leave-active-class="transition duration-200 ease-in motion-reduce:transition-none"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        :class="[
          'pointer-events-auto flex max-w-lg items-center gap-1 rounded-2xl py-1.5 pr-1.5 pl-4 shadow-xl',
          t.tone === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background',
        ]"
      >
        <p class="min-w-0 flex-1 py-1.5 text-[0.9375rem] font-semibold">{{ t.message }}</p>
        <button
          v-if="t.action"
          type="button"
          class="h-10 shrink-0 rounded-xl px-3 text-[0.9375rem] font-bold underline-offset-2 hover:underline"
          @click="runAction(t.id, t.action.run)"
        >
          {{ t.action.label }}
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          class="flex size-11 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100"
          @click="dismissToast(t.id)"
        >
          <X class="size-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
