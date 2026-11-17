<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import DancerEditor from '../DancerEditor.vue'
import FeedbackHost from '@/components/admin/FeedbackHost.vue'
import { toasts } from '@/lib/admin/feedback'
import { channel, editorMessage, editorOrigin } from './protocol'
import type { EditorContext, EditorWrite, EditorResult, AccessRequest } from './types'
const query = new URLSearchParams(location.search)
const origin = query.get('parent') || ''
const session = query.get('session') || ''
const allowed =
  window.parent !== window &&
  editorOrigin(origin, import.meta.env.DEV) &&
  /^[a-f0-9-]{36}$/.test(session)
const context = ref<EditorContext & { canManageAccess?: boolean; canVerifyEmail?: boolean }>()
let pending:
  | {
      id: string
      resolve: (value: EditorResult) => void
      reject: (reason: Error) => void
    }
  | undefined
let accessPending:
  | { id: string; resolve: (value: unknown) => void; reject: (reason: Error) => void }
  | undefined
function manageAccess(request: AccessRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (accessPending) {
      reject(new Error('Wait for the current change.'))
      return
    }
    const id = crypto.randomUUID()
    accessPending = { id, resolve, reject }
    try {
      send('access', { request: JSON.parse(JSON.stringify(request)), requestId: id })
    } catch (error) {
      accessPending = undefined
      reject(error instanceof Error ? error : new Error('Could not manage access.'))
    }
  })
}
let result: EditorResult | undefined
function send(type: string, data = {}) {
  if (allowed) parent.postMessage({ channel, session, type, ...data }, origin)
}
function persist(write: EditorWrite): Promise<EditorResult> {
  return new Promise((resolve, reject) => {
    pending = { id: write.requestId, resolve, reject }
    send('write', { write })
  })
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
  } else if (
    data.type === 'access-result' &&
    accessPending &&
    accessPending.id === data.requestId
  ) {
    const current = accessPending
    accessPending = undefined
    if (typeof data.error === 'string') current.reject(new Error(data.error))
    else current.resolve(data.result)
  } else if (data.type === 'result' && pending && pending.id === data.requestId) {
    const current = pending
    pending = undefined
    if (typeof data.error === 'string') current.reject(new Error(data.error))
    else current.resolve(data.result)
  }
}
onMounted(() => {
  window.addEventListener('message', receive)
  send('hello')
})
onBeforeUnmount(() => {
  window.removeEventListener('message', receive)
  pending?.reject(new Error('Editor closed.'))
  accessPending?.reject(new Error('Editor closed.'))
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
