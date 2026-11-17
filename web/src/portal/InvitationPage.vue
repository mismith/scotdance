<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import { useConnectAccount } from './account'
const props = defineProps<{ token: string }>()
const store = useConnectAccount()
const details = ref<{
  accepted: boolean
  inviter?: string
  dancers: { id: string; name: string }[]
}>()
const busy = ref(false),
  error = ref('')
let generation = 0
async function act(operation: 'inspect' | 'accept') {
  if (busy.value || !store.account) return
  const owner = store.account.uid,
    current = ++generation
  busy.value = true
  error.value = ''
  try {
    const result = await store.request('invitation', { token: props.token, operation })
    if (generation !== current || store.account?.uid !== owner) return
    details.value = result
    if (result.accepted) await store.load()
  } catch (e) {
    if (generation === current)
      error.value = e instanceof Error ? e.message : 'Please try again.'
  } finally {
    if (generation === current) busy.value = false
  }
}
watch(
  () => store.account?.uid,
  () => {
    generation++
    details.value = undefined
    busy.value = false
    void act('inspect')
  },
)
onBeforeUnmount(() => generation++)
onMounted(() => {
  void act('inspect')
})
</script>
<template>
  <section class="max-w-lg space-y-5">
    <h1 class="text-title font-bold">
      {{ details?.accepted ? 'Dancers added' : 'Dancer invitation' }}
    </h1>
    <template v-if="details">
      <p>
        {{
          details.accepted
            ? 'You now have the same access as every other owner.'
            : `${details.inviter} invited you to share these dancers.`
        }}
      </p>
      <ul class="space-y-2">
        <li v-for="dancer in details.dancers" :key="dancer.id" class="font-semibold">
          {{ dancer.name }}
        </li>
      </ul>
      <p v-if="!details.accepted" class="text-muted-foreground">
        You can edit, enter competitions, invite people, remove owners and delete these
        dancers. Your personal account and payment details stay private.
      </p>
      <Button v-if="details.accepted" to="/dancers" variant="primary"
        >Your dancers</Button
      >
      <Button v-else variant="primary" :busy="busy" @click="act('accept')"
        >Accept invitation</Button
      >
    </template>
    <p v-else-if="busy" role="status">Checking invitation…</p>
    <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>
    <div v-if="error" class="flex flex-wrap gap-2">
      <Button href="/account" target="_blank">Account</Button
      ><Button :busy="busy" @click="act('inspect')">Check again</Button>
    </div>
  </section>
</template>
