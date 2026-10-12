<script setup lang="ts">
import { computed, ref } from 'vue'
import { Lock } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import { useSharedSheet } from '@/composables/admin/useSharedParts'
import { changeLink } from '@/lib/admin/links'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { partNoun, sharedLine } from '@/lib/admin/linkWords'
import { linkPartLabel } from '@/lib/linked'

// What tapping anything locked opens (ADR 0007 §7): where it's shared from,
// and the two ways out: change it there, or stop sharing it here (keeping
// what's here). One per page, for every locked thing on it.
const sheet = useSharedSheet()!
const part = computed(() => sheet.part.value)
const open = computed(() => (part.value ? sheet.mainTo(part.value === 'staff' ? 'manage.staff' : 'manage.details') : null))

const busy = ref(false)
async function stopSharing() {
  const p = part.value
  if (!p || busy.value) return
  busy.value = true
  try {
    await changeLink({ action: 'sync', competitionId: sheet.competitionId.value, part: p, on: false })
    toast(`${linkPartLabel(p)}: its own now`)
    void sheet.morph.hide()
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Dialog :open="sheet.morph.open" :morph="sheet.morph" variant="sheet" size="sm" @close="sheet.morph.hide()">
    <template #header>
      <h2 class="text-title flex items-center gap-2"><Lock class="text-muted-foreground size-5 shrink-0" aria-hidden="true" /> Shared from {{ sheet.mainName.value }}</h2>
    </template>
    <div v-if="part" class="space-y-3 p-4 pt-1 pb-[calc(1.5rem+var(--safe-bottom))]">
      <p class="text-muted-foreground text-base">{{ sharedLine(part) }}</p>
      <div class="space-y-2.5 pt-2">
        <Button v-if="open" variant="primary" size="lg" block :to="open" @click="sheet.morph.dismiss()">Open {{ sheet.mainName.value }}</Button>
        <Button size="lg" block :disabled="!canEdit" :busy="busy" @click="stopSharing">Stop sharing its {{ partNoun(part) }}</Button>
        <p class="text-muted-foreground text-center text-sm">This one keeps what it has now, to change here.</p>
      </div>
    </div>
  </Dialog>
</template>
