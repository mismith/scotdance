<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { Check, ChevronDown, Mail, MailX, Send } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import { selectionHaptic } from '@/lib/haptics'
import type { Morph } from '@/lib/morph'
import { REASONS, emails, pickReason, replyEmail, type RejectReason } from '@/lib/admin/submissions'
import { canEdit } from '@/lib/admin/write'
import { useMeStore } from '@/stores/me'

// Rejecting a submission: a reason, for the record, and a reply. Both are
// optional. A reply is emailed to them inside a short note from you (the
// preview shows it whole); leave it empty and no one is told. A reason starts
// a reply in your words, to change or clear. Spam gets none.

const props = defineProps<{
  morph: Morph
  competition?: { name?: unknown; date?: unknown; venue?: unknown; location?: unknown }
  contact?: { name?: string; email?: string }
  busy?: boolean
}>()
const emit = defineEmits<{ reject: [{ reason: RejectReason | null; reply: string | null }] }>()

const me = useMeStore()
const replyId = useId()
const noteId = useId()
const box = ref<HTMLTextAreaElement | null>(null)
const state = ref({ reason: null as RejectReason | null, reply: '', suggested: '' })
// Each opening draws the form afresh (the preview folded again, too).
const opens = ref(0)

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

// A fresh start each time. With a keyboard to hand (a laptop), straight into
// the reply; on a phone the keyboard waits until it's asked for.
watch(
  () => props.morph.open,
  async (open) => {
    if (!open) return
    state.value = { reason: null, reply: '', suggested: '' }
    opens.value += 1
    if (!matchMedia('(pointer: fine)').matches) return
    await nextTick()
    requestAnimationFrame(() => box.value?.focus({ preventScroll: true }))
  },
)

const name = computed(() => (typeof props.competition?.name === 'string' && props.competition.name.trim()) || 'this competition')
const canReply = computed(() => !!props.contact?.email)
const spam = computed(() => state.value.reason === 'spam')
const sends = computed(() => canReply.value && emails(state.value.reason, state.value.reply))
const note = computed(() => {
  if (!canReply.value) return 'There’s no email address to reply to, so no one is told.'
  if (spam.value) return 'Spam never gets a reply: one would confirm the address works.'
  return sends.value ? `They’ll get this by email at ${props.contact?.email}.` : 'Leave it empty and no one is told.'
})
const email = computed(() =>
  replyEmail({ competition: props.competition, contactName: props.contact?.name, reply: state.value.reply, signer: me.displayName }),
)

function pick(value: RejectReason) {
  state.value = pickReason(state.value, value)
  selectionHaptic()
}

function submit() {
  if (props.busy || !canEdit.value) return
  emit('reject', { reason: state.value.reason, reply: sends.value ? state.value.reply.trim() : null })
}

// ⌘Enter (Ctrl+Enter) rejects, as it approves outside. (Kept from the page,
// which would take it as Approve.)
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || !(isMac ? e.metaKey : e.ctrlKey) || e.isComposing) return
  e.preventDefault()
  e.stopPropagation()
  submit()
}
</script>

<template>
  <Dialog :open="morph.open" :morph="morph" variant="sheet" size="md" @close="morph.hide()">
    <template #header>
      <h2 class="text-title">Reject {{ name }}?</h2>
    </template>
    <form :key="opens" class="space-y-6 px-4 pt-4" @submit.prevent="submit" @keydown="onKeydown">
      <fieldset>
        <legend class="text-callout mb-2 font-medium">Reason <span class="text-muted-foreground font-normal">(optional)</span></legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="r in REASONS"
            :key="r.value"
            type="button"
            :aria-pressed="state.reason === r.value"
            :class="[
              'press focus-inset text-callout inline-flex h-11 items-center gap-1.5 rounded-full px-4 font-semibold forced-colors:border',
              state.reason === r.value ? 'bg-blue-paper text-primary' : 'surface',
            ]"
            @click="pick(r.value)"
          >
            <Check v-if="state.reason === r.value" class="size-4 shrink-0" stroke-width="2.5" aria-hidden="true" />
            {{ r.label }}
          </button>
        </div>
      </fieldset>

      <div class="space-y-1.5">
        <label :for="replyId" class="text-callout font-medium">Reply <span class="text-muted-foreground font-normal">(optional)</span></label>
        <textarea
          :id="replyId"
          ref="box"
          v-model="state.reply"
          rows="5"
          :disabled="spam || !canReply"
          :aria-describedby="noteId"
          :placeholder="spam || !canReply ? undefined : 'Anything you’d like to tell or ask them'"
          :class="[
            'placeholder:text-muted-foreground block min-h-32 w-full rounded-xl px-3 py-2.5 text-base leading-normal',
            spam || !canReply ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-[inset_0_0_0_1px_var(--border)]' : 'field',
          ]"
        />
        <p :id="noteId" :class="['flex items-start gap-1.5 text-sm', sends ? 'text-primary font-medium' : 'text-muted-foreground']" aria-live="polite">
          <component :is="sends ? Mail : MailX" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{{ note }}</span>
        </p>
      </div>

      <!-- What they'll get: the reply (in the page's ink) inside the note around it. -->
      <details v-show="sends" class="group surface overflow-hidden rounded-2xl">
        <summary class="press-row focus-inset text-callout flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
          Preview the email
          <ChevronDown class="text-muted-foreground ml-auto size-5 transition-transform duration-(--dur-base) ease-snappy group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div class="space-y-4 border-t px-4 pt-3 pb-4">
          <div>
            <p class="text-base font-semibold">{{ email.subject }}</p>
            <p class="text-muted-foreground text-sm">To {{ contact?.email }}</p>
          </div>
          <div class="text-muted-foreground space-y-3 text-base">
            <p>{{ email.greeting }}</p>
            <p>{{ email.intro }}</p>
            <p v-for="(lines, i) in email.reply" :key="i" class="text-foreground">
              <template v-for="(line, j) in lines" :key="j"><br v-if="j" />{{ line }}</template>
            </p>
            <p class="bg-muted rounded-lg px-3 py-2">
              <template v-for="(line, j) in email.summary" :key="j"><br v-if="j" />{{ line }}</template>
            </p>
            <p>{{ email.closing }}</p>
            <p>
              <template v-for="(line, j) in email.signature" :key="j"><br v-if="j" />{{ line }}</template>
            </p>
          </div>
        </div>
      </details>

      <!-- Kept in reach at the foot of the sheet, however long the preview. -->
      <div class="bg-raised sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t px-4 pt-3 pb-[calc(1rem+var(--safe-bottom))] sm:flex-row sm:justify-end">
        <Button size="lg" @click="morph.hide()">Cancel</Button>
        <Button type="submit" variant="primary" size="lg" :busy="busy" :disabled="!canEdit" :aria-keyshortcuts="isMac ? 'Meta+Enter' : 'Control+Enter'">
          <Send v-if="sends" /> {{ sends ? 'Reject and email' : 'Reject' }}
        </Button>
      </div>
    </form>
  </Dialog>
</template>
