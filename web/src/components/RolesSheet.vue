<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
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

async function save() {
  saving.value = true
  await r.save(picked.value)
  saving.value = false
  r.close()
}
</script>

<template>
  <Dialog :open="r.sheetOpen.value" variant="sheet" @close="r.close()">
    <template #header>
      <h2 class="text-title">How do you use ScotDance?</h2>
    </template>
    <div class="space-y-4 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <p class="text-base">Pick all that apply.</p>
      <div class="space-y-2" role="group" aria-label="How you use ScotDance">
        <button
          v-for="role in ROLES"
          :key="role.id"
          type="button"
          role="checkbox"
          :aria-checked="!!picked[role.id]"
          :class="[
            'flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 py-2 text-left transition-colors',
            picked[role.id] ? 'border-primary bg-blue-paper' : 'border-border bg-card',
          ]"
          @click="picked = { ...picked, [role.id]: !picked[role.id] }"
        >
          <span
            :class="[
              'flex size-6 shrink-0 items-center justify-center rounded-md border-2',
              picked[role.id] ? 'border-primary bg-primary text-primary-foreground' : 'border-strong',
            ]"
          >
            <Check v-if="picked[role.id]" class="size-4" stroke-width="3" />
          </span>
          <span class="min-w-0">
            <span class="block text-base font-bold">{{ role.label }}</span>
            <span class="text-muted-foreground block text-sm">{{ role.hint }}</span>
          </span>
        </button>
      </div>
      <p class="text-muted-foreground text-sm leading-relaxed">
        ScotDance uses this to fit the app to you. Teachers get a compact list for following a whole class, and
        organisers get quick access to their competitions. It also tells the volunteer who builds ScotDance who it’s
        for, so the next features help the right people. Change it any time in More.
      </p>
      <button
        type="button"
        class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-60"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
      <button type="button" class="text-muted-foreground h-11 w-full text-[0.9375rem] font-bold" @click="r.close()">
        Skip for now
      </button>
    </div>
  </Dialog>
</template>
