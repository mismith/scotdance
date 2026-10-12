<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import { useSharedSheet } from '@/composables/admin/useSharedParts'
import { changeLink } from '@/lib/admin/links'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { linkPartLabel } from '@/lib/linked'
import { useMeStore } from '@/stores/me'

// What tapping anything locked opens (ADR 0007 §7): where it's shared from,
// and the two ways out: edit it there, or here instead (which stops sharing
// it, keeping what's here). One per page, for every locked thing on it.
const sheet = useSharedSheet()!
const me = useMeStore()
const part = computed(() => sheet.part.value)
// Edit there: only for those who manage the main one.
const there = computed(() => {
  const id = sheet.mainId.value
  if (!part.value || !id || !me.hasCompetitionPerm(id)) return null
  return sheet.mainTo(part.value === 'staff' ? 'manage.staff' : 'manage.details')
})

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
      <h2 class="text-title">Shared from {{ sheet.mainName.value }}</h2>
    </template>
    <div v-if="part" class="space-y-3 p-4 pt-1 pb-[calc(1.5rem+var(--safe-bottom))]">
      <p class="text-muted-foreground text-base">
        Edits there show up here too.<template v-if="part === 'staff'"> Who judges where is still set here, in Schedule.</template>
      </p>
      <div class="space-y-2.5 pt-2">
        <Button v-if="there" variant="primary" size="lg" block :to="there" @click="sheet.morph.dismiss()">Edit there</Button>
        <Button :variant="there ? 'secondary' : 'primary'" size="lg" block :disabled="!canEdit" :busy="busy" @click="stopSharing">Edit here instead</Button>
        <p class="text-muted-foreground text-center text-sm">That stops sharing it. What’s here stays.</p>
      </div>
    </div>
  </Dialog>
</template>
