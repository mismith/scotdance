<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import { selectionHaptic } from '@/lib/haptics'
import { ROLES, useRoles, type Role } from '@/composables/useRoles'

const r = useRoles()
const picked = ref<Partial<Record<Role, boolean>>>({})
const saving = ref(false)

watch(
  () => r.sheetOpen.value,
  (open) => {
    if (open) picked.value = { ...r.roles.value }
  },
)

function toggle(id: Role) {
  picked.value = { ...picked.value, [id]: !picked.value[id] }
  selectionHaptic()
}

async function save() {
  saving.value = true
  try {
    await r.save(picked.value)
  } catch (e) {
    // Roles are a nicety: if they don't save, don't leave the sheet stuck.
    console.warn('[roles] save failed', e)
  } finally {
    saving.value = false
    r.close()
  }
}
</script>

<template>
  <Dialog :open="r.sheetOpen.value" :morph="r.sheet" variant="sheet" @close="r.close()">
    <template #header>
      <h2 class="text-title">How do you use ScotDance.app?</h2>
    </template>
    <div class="space-y-4 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <p class="text-base">Pick all that apply.</p>
      <div class="surface rows-inset overflow-hidden rounded-2xl [--inset:3.375rem]" role="group" aria-label="How you use ScotDance.app">
        <button
          v-for="role in ROLES"
          :key="role.id"
          type="button"
          role="checkbox"
          :aria-checked="!!picked[role.id]"
          class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
          @click="toggle(role.id)"
        >
          <Checkbox :checked="!!picked[role.id]" />
          <span class="min-w-0">
            <span class="block text-base font-medium">{{ role.label }}</span>
            <span class="text-muted-foreground block text-sm">{{ role.hint }}</span>
          </span>
        </button>
      </div>
      <p class="text-muted-foreground text-sm leading-relaxed">
        ScotDance.app uses this to fit itself to you. Teachers get a compact list for following a whole class, and
        organisers get quick access to their competitions. It also tells the volunteer who builds ScotDance.app who it’s
        for, so the next features help the right people. Change it any time in your account.
      </p>
      <Button variant="primary" size="lg" block :busy="saving" @click="save">Save</Button>
      <Button variant="plain" size="lg" block @click="r.close()">Skip for now</Button>
    </div>
  </Dialog>
</template>
