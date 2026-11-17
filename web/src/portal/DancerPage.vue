<script setup lang="ts">
import { watch, ref, onMounted } from 'vue'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import DancerEditor from './DancerEditor.vue'
import { useConnectAccount, type Dancer } from './account'
import type { EditorWrite, EditorResult, AccessRequest } from './editor/types'
const props = defineProps<{ dancer?: Dancer }>()
const emit = defineEmits<{ close: [] }>()
const store = useConnectAccount()
const owner = store.account?.uid
const photo = ref<{ value: string | null }>()
const photoError = ref('')
async function loadPhoto() {
  photoError.value = ''
  try { photo.value = { value: props.dancer?.photoVersion ? await store.loadPhoto(props.dancer.id) : null } }
  catch (e) { photoError.value = e instanceof Error ? e.message : 'Could not load photo.' }
}
onMounted(loadPhoto)
watch(
  () => store.account?.uid,
  (uid) => {
    if (uid !== owner) emit('close')
  },
)
// Capture defaults alongside the draft. Background refreshes must not bless stale writes.
const defaults = structuredClone(JSON.parse(JSON.stringify(store.defaults)))
const defaultsRevision = store.defaultsRevision
const otherDancers = store.dancers.some((d) => d.id !== props.dancer?.id)
async function manageAccess({ action, ...body }: AccessRequest) {
  if (!owner || store.account?.uid !== owner)
    throw new Error('Sign in again to manage access.')
  const result = await store.request(action, body)
  if (store.account?.uid !== owner) throw new Error('Sign in again to manage access.')
  if (action === 'invite' || body.operation !== 'list') await store.load()
  return result
}
async function persist(write: EditorWrite): Promise<EditorResult> {
  if (!owner || store.account?.uid !== owner)
    throw new Error('Sign in again to edit your dancers.')
  if (
    !(await store.save(
      write.dancer,
      write.action === 'delete',
      write.defaults,
      write.requestId,
      write.defaultsRevision,
      write.photo,
    ))
  )
    throw new Error(store.error)
  return write.action === 'delete'
    ? { deleted: true, id: write.dancer.id }
    : {
        id: write.dancer.id,
        dancer: store.dancers.find((d) => d.id === write.dancer.id)!,
      }
}
</script>
<template>
  <DancerEditor
    v-if="photo"
    :photo="photo"
    :dancer="dancer"
    :defaults="defaults"
    :defaults-revision="defaultsRevision"
    :other-dancers="otherDancers"
    :persist="persist"
    :manage-access="manageAccess"
    @close="emit('close')"
  />
  <Dialog v-else :open="true" :morph="false" @close="emit('close')" aria-label="Dancer">
    <div v-if="photoError" role="alert">{{ photoError }} <Button @click="loadPhoto">Try again</Button></div>
    <div v-else class="space-y-4 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Loading dancer">
      <div class="h-8 w-1/2 rounded bg-foreground/10" /><div class="h-40 rounded bg-foreground/10" />
    </div>
  </Dialog>
</template>
