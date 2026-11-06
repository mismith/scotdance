<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
import AdminMark from '@/components/AdminMark.vue'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import FormInput from '@/components/admin/FormInput.vue'
import { setDancerHidden, useDancerHidden } from '@/composables/useDancerHidden'
import { BASIC_LATEST } from '@/composables/useDancerRecord'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { formatLongDate } from '@/lib/format'
import { useMorph } from '@/lib/morph'
import { useMeStore } from '@/stores/me'

// A system admin's control on a dancer's profile, for when a family asks:
// hiding it turns off the signed-in extra (every competition, not just the
// latest few), so everyone sees the basic profile. They stay in Search,
// Dancers and every competition's results. Nothing for anyone else. (System admin ›
// Directory › Hidden profiles lists them all, to show again.)

const props = defineProps<{
  dancerId: string
  /** The dancer's name; its first word is who the sheet speaks of. */
  name: string
}>()

const me = useMeStore()
const sheet = useMorph()
const { hidden, info, loading } = useDancerHidden(computed(() => props.dancerId))
const firstName = computed(() => props.name.trim().split(/\s+/)[0] || 'This dancer')
const label = computed(() => (hidden.value ? 'Show profile again' : 'Hide profile'))

const note = ref('')
const busy = ref(false)
watch(
  () => sheet.open,
  (open) => {
    if (open) note.value = ''
  },
)

async function submit() {
  if (busy.value || loading.value || !canEdit.value) return
  const hide = !hidden.value
  busy.value = true
  try {
    await setDancerHidden(props.dancerId, hide, note.value)
    void sheet.hide()
    toast(hide ? `${firstName.value}’s profile is hidden` : `${firstName.value}’s profile is showing again`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <template v-if="me.isAdmin">
    <button
      type="button"
      :aria-label="label"
      :title="label"
      class="press hover:bg-accent flex size-9 items-center justify-center rounded-full"
      @click="sheet.show($event)"
    >
      <span class="relative flex">
        <EyeOff v-if="hidden" class="size-5" aria-hidden="true" />
        <Eye v-else class="size-5" aria-hidden="true" />
        <AdminMark ring="background" />
      </span>
    </button>

    <Dialog :open="sheet.open" :morph="sheet" variant="sheet" size="md" @close="sheet.hide()">
      <template #header>
        <h2 class="text-title">{{ label }}</h2>
      </template>
      <form class="space-y-5 px-4 pt-4" @submit.prevent="submit">
        <p v-if="info" class="bg-muted rounded-xl px-3 py-2.5 text-base">
          Hidden by {{ info.byName }} on {{ formatLongDate(info.at) }}.
          <template v-if="info.note"><br /><span class="text-muted-foreground">{{ info.note }}</span></template>
        </p>
        <p class="text-muted-foreground text-base">
          <template v-if="hidden">Signed-in people see all of {{ firstName }}’s competitions again.</template>
          <template v-else>
            Everyone sees {{ firstName }}’s profile as if signed out: the latest {{ BASIC_LATEST }} competitions only. {{ firstName }} stays in Search, Dancers and every competition’s results.
          </template>
        </p>
        <FormInput v-if="!hidden" v-model="note" label="Note for admins" placeholder="A parent asked by email" />
        <div class="frosted-paper sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t px-4 pt-3 pb-[calc(1rem+var(--safe-bottom))] sm:flex-row sm:justify-end">
          <Button size="lg" @click="sheet.hide()">Cancel</Button>
          <Button type="submit" variant="primary" size="lg" :busy="busy" :disabled="loading || !canEdit">{{ label }}</Button>
        </div>
      </form>
    </Dialog>
  </template>
</template>
