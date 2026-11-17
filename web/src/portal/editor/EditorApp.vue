<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import DancerEditor from '../DancerEditor.vue'
import FeedbackHost from '@/components/admin/FeedbackHost.vue'
import { toasts } from '@/lib/admin/feedback'
import { channel, editorMessage, editorOrigin } from './protocol'
import { hostRequests } from './requests'
import type { EditorContext, EditorWrite, EditorResult, AccessRequest } from './types'
const query = new URLSearchParams(location.search)
const origin = query.get('parent') || ''
const session = query.get('session') || ''
const allowed =
  window.parent !== window &&
  editorOrigin(origin, import.meta.env.DEV) &&
  /^[a-f0-9-]{36}$/.test(session)
const context = ref<EditorContext & { canManageAccess?: boolean; canVerifyEmail?: boolean }>()
const requests = hostRequests(send)
function manageAccess(request: AccessRequest): Promise<unknown> {
  const requestId = crypto.randomUUID()
  return requests.request('access', 'access-result', requestId, {
    request: JSON.parse(JSON.stringify(request)),
    requestId,
  })
}
let result: EditorResult | undefined
function send(type: string, data = {}) {
  if (allowed) parent.postMessage({ channel, session, type, ...data }, origin)
}
function persist(write: EditorWrite): Promise<EditorResult> {
  return requests.request('write', 'result', write.requestId, { write })
}
async function receive(event: MessageEvent) {
  if (!allowed || !editorMessage(event, parent, origin, session)) return
  const data = event.data
  if (data.type === 'init' && !context.value) {
    context.value = data.context
    await nextTick()
    await document.fonts.ready
    send('ready', {
      scheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    })
  } else requests.settle(data.type, data)
}
onMounted(() => {
  window.addEventListener('message', receive)
  send('hello')
})
onBeforeUnmount(() => {
  window.removeEventListener('message', receive)
  requests.cancel('Editor closed.')
})
</script>
<template>
  <FeedbackHost v-if="toasts.length" />
  <DancerEditor
    v-if="context"
    v-bind="context"
    :persist="persist"
    :manage-access="context.canManageAccess ? manageAccess : undefined"
    :verify-email="context.canVerifyEmail && context.dancer ? async () => { await manageAccess({ action: 'verify-email', id: context!.dancer!.id }) } : undefined"
    @saved="result = $event"
    @close="send('closed', { result })"
  />
  <p v-else-if="!allowed" role="alert">
    Open this editor from ScotDance Connect, Entries or your studio’s parent portal.
  </p>
</template>
