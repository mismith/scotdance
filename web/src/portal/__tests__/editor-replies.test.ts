import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
// @ts-expect-error The public loader is plain JavaScript, served as-is to host apps.
import { openDancerEditor } from '../../../portal/public/dancer-editor.js'
import { hostRequests, noReply, replyTimeout } from '../editor/requests'
import { channel } from '../editor/protocol'
import type { Dancer } from '../account'

const dancer: Dancer = { id: 'd1', revision: 3, firstName: 'Test', lastName: 'Dancer', birthday: '2015-01-01', category: 'Novice', studio: 'Studio', registrationNumber: '', location: { town: 'Calgary', province: 'AB', country: 'Canada' } }

function deferred<T = unknown>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

let controller = new AbortController()
/** Opens the loader and plays the frame's side of the conversation. */
async function openLoader(adapters: Record<string, unknown>) {
  const opened = openDancerEditor({ load: async () => ({ dancer, defaults: { studio: '' }, defaultsRevision: 1, otherDancers: false }), save: vi.fn(), signal: controller.signal, ...adapters })
  const frame = document.querySelector('dialog[data-scotdance-editor] div')!.shadowRoot!.querySelector('iframe')!
  // happy-dom does not load frames: stand in for the editor window.
  const replies: Record<string, unknown>[] = []
  const target = { postMessage: (message: Record<string, unknown>) => replies.push(message) } as unknown as Window
  Object.defineProperty(frame, 'contentWindow', { value: target })
  const session = new URL(frame.src).searchParams.get('session')
  // The loader's origin is its own module URL's: file:// under Vitest.
  const origin = 'null'
  const post = async (type: string, values = {}) => {
    window.dispatchEvent(new MessageEvent('message', { data: { channel, session, type, ...values }, origin, source: target }))
    await flushPromises()
  }
  await post('hello')
  await post('ready', { scheme: 'light' })
  return { opened, post, replies }
}
const write = (requestId: string, revision = 3) => ({ write: { action: 'save', requestId, dancer: { ...dancer, revision }, defaults: {}, defaultsRevision: 1 } })
const list = (requestId: string) => ({ requestId, request: { action: 'access', id: 'd1', operation: 'list' } })

afterEach(() => {
  vi.restoreAllMocks()
  controller.abort()
  controller = new AbortController()
  vi.useRealTimers()
  document.querySelectorAll('dialog').forEach((dialog) => dialog.remove())
})

describe('hosted editor loader', () => {
  // happy-dom reports each frame it declines to load.
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
  it('saves while a sharing poll is still waiting', async () => {
    const poll = deferred()
    const save = vi.fn(async () => ({ id: 'd1', dancer: { ...dancer, revision: 4 } }))
    const { opened, post, replies } = await openLoader({ save, manageAccess: () => poll.promise })
    await post('access', list('poll'))
    await post('write', write('save-1'))
    expect(save).toHaveBeenCalledOnce()
    expect(replies).toContainEqual(expect.objectContaining({ type: 'result', requestId: 'save-1', result: { id: 'd1', dancer: { ...dancer, revision: 4 } } }))
    poll.resolve({ owners: [] })
    await post('closed')
    await expect(opened).resolves.toEqual({ id: 'd1', dancer: { ...dancer, revision: 4 } })
  })

  it('runs a save after a sharing change, in order, and replies to both', async () => {
    const change = deferred()
    const order: string[] = []
    const save = vi.fn(async () => { order.push('save'); return { id: 'd1', dancer } })
    const manageAccess = vi.fn(async () => { await change.promise; order.push('invite'); return {} })
    const { post, replies } = await openLoader({ save, manageAccess })
    await post('access', { requestId: 'invite', request: { action: 'invite', id: 'd1', email: 'a@example.test', ids: ['d1'] } })
    await post('write', write('save-1'))
    expect(save).not.toHaveBeenCalled()
    change.resolve(undefined)
    await flushPromises()
    expect(order).toEqual(['invite', 'save'])
    expect(replies.map((reply) => reply.requestId).filter(Boolean)).toEqual(['invite', 'save-1'])
  })

  it('answers a stale save with an error instead of ignoring it', async () => {
    const save = vi.fn()
    const { post, replies } = await openLoader({ save })
    await post('write', write('stale', 2))
    expect(save).not.toHaveBeenCalled()
    expect(replies).toContainEqual(expect.objectContaining({ type: 'result', requestId: 'stale', error: expect.any(String) }))
  })

  it('closes after a save that was still running when the editor closed', async () => {
    const saved = deferred<unknown>()
    const result = { id: 'd1', dancer: { ...dancer, revision: 4 } }
    const { opened, post, replies } = await openLoader({ save: () => saved.promise })
    let settled = false
    void opened.then(() => { settled = true })
    await post('write', write('save-1'))
    await post('closed')
    expect(settled).toBe(false)
    expect(document.querySelector('dialog[data-scotdance-editor]')).not.toBeNull()
    saved.resolve(result)
    await flushPromises()
    expect(replies).toContainEqual(expect.objectContaining({ type: 'result', requestId: 'save-1', result }))
    await expect(opened).resolves.toEqual(result)
    expect(document.querySelector('dialog[data-scotdance-editor]')).toBeNull()
  })
})

describe('editor frame requests', () => {
  it('times out a lost reply and ignores it if it arrives late', async () => {
    vi.useFakeTimers()
    const requests = hostRequests(() => {})
    const pending = requests.request('write', 'result', 'save-1', {})
    const failed = expect(pending).rejects.toThrow(noReply)
    await vi.advanceTimersByTimeAsync(replyTimeout)
    await failed
    expect(requests.settle('result', { requestId: 'save-1', result: {} })).toBe(false)
  })

  it('shows the timeout and lets the parent save again', async () => {
    vi.useFakeTimers()
    const sent: string[] = []
    const requests = hostRequests((type) => sent.push(type))
    const { default: DancerEditor } = await import('../DancerEditor.vue')
    const w = mount(DancerEditor, {
      attachTo: document.body,
      props: { dancer, defaults: { studio: '' }, defaultsRevision: 1, otherDancers: false, hiddenFields: ['photo', 'publicDancer'], persist: (body) => requests.request('write', 'result', body.requestId, { write: body }) },
    })
    await flushPromises()
    const saveButton = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save')!
    saveButton().click()
    await flushPromises()
    expect(sent).toEqual(['write'])
    expect(saveButton().disabled).toBe(true)
    await vi.advanceTimersByTimeAsync(replyTimeout)
    await flushPromises()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(noReply)
    expect(saveButton().disabled).toBe(false)
    saveButton().click()
    await flushPromises()
    expect(sent).toEqual(['write', 'write'])
    w.unmount()
  })
})
