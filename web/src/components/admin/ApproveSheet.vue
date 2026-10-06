<script setup lang="ts">
import { CircleAlert } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import type { Morph } from '@/lib/morph'
import { canEdit } from '@/lib/admin/write'

// Approving several submissions at once. Each becomes a competition and emails
// its organiser, so they're listed first, with anything that'd usually be
// tidied (or checked) one at a time flagged: not on the map yet, or listed
// under an organisation the submitter doesn't run.

defineProps<{
  morph: Morph
  items: ReadonlyArray<{ id: string; name: string; line: string; flags: string[] }>
  busy?: boolean
}>()
const emit = defineEmits<{ approve: [] }>()
</script>

<template>
  <Dialog :open="morph.open" :morph="morph" variant="sheet" size="md" @close="morph.hide()">
    <template #header>
      <h2 class="text-title">Approve {{ items.length }} {{ items.length === 1 ? 'competition' : 'competitions' }}?</h2>
    </template>
    <div class="space-y-4 px-4 pt-4">
      <p class="text-base">Each is created (unlisted, so only admins see it), and its organiser gets access and an email with a link.</p>
      <ul class="surface divide-y overflow-hidden rounded-2xl">
        <li v-for="s in items" :key="s.id" class="space-y-0.5 px-4 py-2.5">
          <span class="block text-base font-medium">{{ s.name }}</span>
          <span v-if="s.line" class="text-muted-foreground block text-sm">{{ s.line }}</span>
          <span v-for="f in s.flags" :key="f" class="text-next-foreground flex items-start gap-1.5 text-sm font-medium">
            <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {{ f }}
          </span>
        </li>
      </ul>
      <p v-if="items.some((s) => s.flags.length)" class="text-muted-foreground text-sm">
        To tidy one first, cancel and open it. The rest can still go together.
      </p>
      <!-- Kept in reach at the foot of the sheet, however long the list. -->
      <div class="bg-raised sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t px-4 pt-3 pb-[calc(1rem+var(--safe-bottom))] sm:flex-row sm:justify-end">
        <Button size="lg" @click="morph.hide()">Cancel</Button>
        <Button variant="primary" size="lg" :busy="busy" :disabled="!canEdit" @click="emit('approve')">
          Approve {{ items.length }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>
