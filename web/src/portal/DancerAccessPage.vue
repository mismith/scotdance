<script setup lang="ts">
import { useRouter } from 'vue-router'
import DancerAccess from './DancerAccess.vue'
import Button from '@/components/ui/Button.vue'
import { useConnectAccount } from './account'
import type { AccessRequest } from './editor/types'
defineProps<{ id: string }>()
const store = useConnectAccount(),
  router = useRouter(),
  owner = store.account?.uid
async function request({ action, ...body }: AccessRequest) {
  if (!owner || store.account?.uid !== owner)
    throw new Error('Sign in again to manage access.')
  const result = await store.request(action, body)
  if (store.account?.uid !== owner) throw new Error('Sign in again to manage access.')
  if (action === 'invite' || body.operation !== 'list') await store.load()
  return result
}
</script>
<template>
  <Button variant="plain" to="/dancers">Back to dancers</Button>
  <DancerAccess :id="id" :request="request" @removed="router.replace('/dancers')" />
</template>
