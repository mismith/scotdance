<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { toast } from '@/lib/admin/feedback'
const props = defineProps<{ send: () => Promise<void> }>()
const emit = defineEmits<{ sent: [] }>()
const busy = ref(false), sent = ref(false), cooling = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let live = true
onScopeDispose(() => { live = false; clearTimeout(timer) })
async function verify() {
  if (busy.value || cooling.value) return
  busy.value = true
  try {
    await props.send()
    if (!live) return
    sent.value = true
    cooling.value = true
    timer = setTimeout(() => { cooling.value = false }, 60000)
    toast('Verification email sent. Check your inbox.')
    emit('sent')
  } catch (error) {
    if (!live) return
    const code = (error as { code?: string }).code
    toast(code === 'auth/too-many-requests' ? 'Too many requests. Please wait before trying again.' : !code && error instanceof Error ? error.message : 'Could not send the verification email. Please try again.', { tone: 'error' })
  } finally { if (live) busy.value = false }
}
</script>
<template>
  <button type="button" class="press-row focus-inset inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-callout font-semibold text-amber-700 dark:text-amber-400 disabled:opacity-60" :disabled="busy || cooling" :aria-busy="busy || undefined" @click="verify">
    <LoaderCircle v-if="busy" class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
    {{ cooling ? 'Sent' : sent ? 'Resend' : 'Verify' }}
  </button>
</template>
