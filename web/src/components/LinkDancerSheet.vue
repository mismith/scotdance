<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { MAX_PENDING, RELATIONSHIPS, useGuardiansStore, type Relationship } from '@/stores/guardians'

// "Is this your dancer?" Asking to link, with why and what happens next.
const props = defineProps<{ open: boolean; dancerId: string; dancerName: string }>()
const emit = defineEmits<{ close: [] }>()

const guardians = useGuardiansStore()
const relationship = ref<Relationship | null>(null)
const note = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const first = computed(() => props.dancerName.split(' ')[0] || 'this dancer')
const tooMany = computed(() => guardians.pendingCount() >= MAX_PENDING)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    relationship.value = null
    note.value = ''
    error.value = null
  },
)

async function send() {
  if (!relationship.value) return
  saving.value = true
  error.value = null
  try {
    await guardians.request(props.dancerId, props.dancerName, relationship.value, note.value)
    emit('close')
  } catch {
    error.value = 'That didn’t go through. Check your connection and try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" variant="sheet" @close="emit('close')">
    <template #header>
      <h2 class="text-title">Link {{ first }} to your account</h2>
    </template>
    <div class="space-y-4 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <p class="text-base leading-relaxed">
        Once you’re linked, you can choose the tartan {{ first }} dances in. It shows on their page and colours their
        sash throughout the app.
      </p>
      <div class="space-y-2" role="radiogroup" :aria-label="`How you know ${first}`">
        <button
          v-for="r in RELATIONSHIPS"
          :key="r.value"
          type="button"
          role="radio"
          :aria-checked="relationship === r.value"
          :class="[
            'flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 py-2 text-left text-base font-bold transition-colors',
            relationship === r.value ? 'border-primary bg-blue-paper' : 'border-border bg-card',
          ]"
          @click="relationship = r.value"
        >
          <span
            :class="[
              'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
              relationship === r.value ? 'border-primary bg-primary text-primary-foreground' : 'border-strong',
            ]"
          >
            <Check v-if="relationship === r.value" class="size-4" stroke-width="3" />
          </span>
          {{ r.label }}
        </button>
      </div>
      <label class="block space-y-1.5">
        <span class="text-base font-bold">Anything that helps confirm it <span class="text-muted-foreground font-normal">(optional)</span></span>
        <textarea
          v-model="note"
          rows="2"
          maxlength="280"
          placeholder="Their teacher or dance school, for example"
          class="bg-card border-strong focus:border-primary w-full rounded-xl border-2 px-3 py-2 text-base outline-none"
        />
      </label>
      <p class="text-muted-foreground text-sm leading-relaxed">
        A ScotDance admin, or someone already linked to {{ first }}, checks each request. Who’s linked is never shown
        to anyone else.
      </p>
      <p v-if="tooMany" class="text-base font-semibold">
        You have {{ MAX_PENDING }} requests waiting. Once some are checked, you can ask again.
      </p>
      <p v-if="error" class="text-destructive text-base font-semibold" role="alert">{{ error }}</p>
      <button
        type="button"
        class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-50"
        :disabled="!relationship || saving || tooMany"
        @click="send"
      >
        {{ saving ? 'Sending…' : 'Ask to link' }}
      </button>
    </div>
  </Dialog>
</template>
