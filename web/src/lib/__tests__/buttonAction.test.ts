import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useButtonAction } from '../buttonAction'

function deferred() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const event = () =>
  ({
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  }) as unknown as MouseEvent

describe('waiting button actions', () => {
  it('blocks a second activation before the DOM can update, then permits retry', async () => {
    const wait = deferred()
    const handler = vi.fn(() => wait.promise)
    const action = useButtonAction({ onClick: handler })
    const first = action.click(event())
    expect(action.busy.value).toBe(true)
    const secondEvent = event()
    await action.click(secondEvent)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(secondEvent.preventDefault).toHaveBeenCalled()
    wait.resolve()
    await first
    expect(action.disabled.value).toBe(false)
    await action.click(event())
    expect(handler).toHaveBeenCalledTimes(2)
  })
  it('releases the lock after rejection without swallowing the error', async () => {
    const wait = deferred()
    const action = useButtonAction({ onClick: () => wait.promise })
    const first = action.click(event())
    wait.reject(new Error('offline'))
    await expect(first).rejects.toThrow('offline')
    expect(action.busy.value).toBe(false)
  })
  it('honours an externally controlled busy state and disabled state', async () => {
    const props = reactive({ busy: true, disabled: false, onClick: vi.fn() })
    const action = useButtonAction(props)
    await action.click(event())
    expect(props.onClick).not.toHaveBeenCalled()
    props.busy = false
    props.disabled = true
    expect(action.guard(event())).toBe(false)
    props.disabled = false
    await action.click(event())
    expect(props.onClick).toHaveBeenCalledTimes(1)
  })
  it('does not leave instant actions in a loading state', () => {
    const handler = vi.fn()
    const action = useButtonAction({ onClick: handler })
    void action.click(event())
    expect(handler).toHaveBeenCalledTimes(1)
    expect(action.busy.value).toBe(false)
  })
  it('waits for every handler even when one fails', async () => {
    const wait = deferred()
    const action = useButtonAction({
      onClick: [() => Promise.reject(new Error('failed')), () => wait.promise],
    })
    const first = action.click(event())
    await Promise.resolve()
    expect(action.busy.value).toBe(true)
    wait.resolve()
    await expect(first).rejects.toThrow('failed')
    expect(action.busy.value).toBe(false)
  })
})
