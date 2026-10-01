import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startViewTransition } from '@/lib/transition'

// A view transition makes the page ignore taps while it plays. On a slow or
// busy phone it must not hold the page for long.

function fakeTransitions() {
  const made: Array<{ skipped: boolean; finish: () => void; update: () => Promise<void> }> = []
  const doc = document as Document & { startViewTransition?: unknown }
  doc.startViewTransition = (arg: { update: () => Promise<void> } | (() => Promise<void>)) => {
    const update = typeof arg === 'function' ? arg : arg.update
    let finish!: () => void
    const finished = new Promise<void>((r) => (finish = r))
    const entry = {
      skipped: false,
      finish,
      update,
      ready: Promise.resolve(),
      finished,
      updateCallbackDone: Promise.resolve(),
      skipTransition() {
        entry.skipped = true
        finish()
      },
    }
    made.push(entry)
    void update()
    return entry
  }
  return made
}

describe('startViewTransition', () => {
  let made: ReturnType<typeof fakeTransitions>
  beforeEach(() => {
    vi.useFakeTimers()
    made = fakeTransitions()
  })
  afterEach(() => {
    vi.useRealTimers()
    delete (document as Document & { startViewTransition?: unknown }).startViewTransition
  })

  it('runs the update', async () => {
    const update = vi.fn()
    await startViewTransition(update).captured
    expect(update).toHaveBeenCalledOnce()
  })

  it('cuts a transition short if it runs past its budget', async () => {
    startViewTransition()
    await vi.advanceTimersByTimeAsync(999)
    expect(made[0].skipped).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(made[0].skipped).toBe(true)
  })

  it('leaves a transition alone that finishes in time', async () => {
    startViewTransition()
    made[0].finish()
    await vi.advanceTimersByTimeAsync(5000)
    expect(made[0].skipped).toBe(false)
  })

  it('just updates where View Transitions aren’t supported', async () => {
    delete (document as Document & { startViewTransition?: unknown }).startViewTransition
    const update = vi.fn()
    const t = startViewTransition(update)
    await t.finished
    expect(update).toHaveBeenCalledOnce()
  })
})
