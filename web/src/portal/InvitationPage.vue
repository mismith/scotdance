<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { LoaderCircle } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { toast } from '@/lib/admin/feedback'
import { useConnectAccount } from './account'
const props = defineProps<{ token: string }>()
const store = useConnectAccount()
const router = useRouter()
const busy = ref(false), error = ref('')
let generation = 0
async function accept() {
  if (busy.value || !store.account) return
  const owner = store.account.uid, current = ++generation
  const active = () => generation === current && store.account?.uid === owner
  busy.value = true
  error.value = ''
  try {
    const result = await store.request('invitation', { token: props.token, operation: 'accept' })
    if (!active()) return
    if (!result.accepted) throw new Error('Could not accept this invitation. Please try again.')
    await store.load()
    if (!active()) return
    toast(result.dancers.length === 1 ? 'Dancer added' : 'Dancers added')
    await router.replace('/dancers')
  } catch (e) {
    if (active()) error.value = e instanceof Error ? e.message : 'Please try again.'
  } finally {
    if (generation === current) busy.value = false
  }
}
watch([() => store.account?.uid, () => props.token], () => {
  generation++
  busy.value = false
  error.value = ''
  void accept()
}, { immediate: true })
onBeforeUnmount(() => generation++)
</script>
<template>
  <section class="max-w-lg space-y-5">
    <p v-if="busy" role="status" class="flex items-center gap-2 text-muted-foreground"><LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Adding your dancer…</p>
    <template v-else-if="error">
      <h1 class="text-title font-bold">Could not accept invitation</h1>
      <p role="alert" class="text-destructive">{{ error }}</p>
      <div class="flex flex-wrap gap-2"><Button variant="primary" @click="accept">Try again</Button><Button to="/dancers">Your dancers</Button></div>
    </template>
  </section>
</template>
