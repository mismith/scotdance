import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { DnDProvider, makeDraggable, useDnDProvider } from '@vue-dnd-kit/core'
import { ACTIVATION, payload, useDragInterrupts } from '../drag'

// A drag cut short (a cancelled touch, switching away) must end there, not
// float until the next tap drops it. Driven through the drag kit itself, with
// synthesized pointer events (happy-dom, so no layout: this checks the drag's
// state, not where it would land).

// The kit only lets visible items drag; happy-dom never reports anything as on screen.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: (entries: { target: Element; isIntersecting: boolean }[]) => void) {}
      observe(target: Element) {
        this.cb([{ target, isIntersecting: true }])
      }
      unobserve() {}
      disconnect() {}
    },
  )
})

afterAll(() => vi.unstubAllGlobals())

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function setup() {
  let provider!: ReturnType<typeof useDnDProvider>
  const Chip = defineComponent({
    setup() {
      provider = useDnDProvider()
      useDragInterrupts()
      const el = ref<HTMLElement | null>(null)
      makeDraggable(el, { groups: ['dance'], activation: ACTIVATION }, () =>
        payload({ type: 'dance', danceId: 'd1', rowId: '', index: 0, source: 'palette' }),
      )
      return () => h('div', { ref: el, id: 'chip' }, 'Highland Fling')
    },
  })
  wrapper = mount(DnDProvider, { slots: { default: () => h(Chip) }, attachTo: document.body })
  const chip = document.getElementById('chip')!
  const pointer = (type: string, x: number, init: PointerEventInit = {}) =>
    (type === 'pointerdown' ? chip : document.body).dispatchEvent(
      new PointerEvent(type, { bubbles: true, clientX: x, clientY: 10, isPrimary: true, ...init }),
    )
  return { provider, pointer, state: () => provider.state.value }
}

/** Press on the chip and move far enough to pick it up. */
async function pickUp(t: ReturnType<typeof setup>) {
  await nextTick()
  t.pointer('pointerdown', 10)
  t.pointer('pointermove', 40)
  expect(t.state()).toBe('dragging')
}

describe('useDragInterrupts', () => {
  it('puts the item back when the touch is cancelled, and the next drag works', async () => {
    const t = setup()
    await pickUp(t)
    t.pointer('pointercancel', 40)
    expect(t.state()).toBeUndefined()
    // The page scrolls and selects text again.
    expect(document.body.style.userSelect).toBe('')

    // A later tap elsewhere doesn't pick anything up...
    t.pointer('pointermove', 200)
    t.pointer('pointerup', 200)
    expect(t.state()).toBeUndefined()
    // ...and the next drag starts as normal.
    await pickUp(t)
  })

  it('forgets a press that was cancelled before the drag started', async () => {
    const t = setup()
    await nextTick()
    t.pointer('pointerdown', 10)
    expect(t.state()).toBe('activating')
    t.pointer('pointercancel', 10)
    expect(t.state()).toBeUndefined()
    // Without that, the next touch's move would start dragging this chip.
    t.pointer('pointermove', 200)
    expect(t.state()).toBeUndefined()
  })

  it('ends the drag when the window loses focus or the page is hidden', async () => {
    const t = setup()
    await pickUp(t)
    window.dispatchEvent(new Event('blur'))
    expect(t.state()).toBeUndefined()

    await pickUp(t)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(t.state()).toBeUndefined()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })

  it('keeps the item with the first finger when a second one lands', async () => {
    const t = setup()
    await pickUp(t)
    t.pointer('pointerdown', 300, { isPrimary: false })
    t.pointer('pointermove', 300, { isPrimary: false })
    expect(t.provider.pointer.value?.current.x).toBe(40)
    // A second finger's cancel (a palm, say) leaves the drag alone.
    t.pointer('pointercancel', 300, { isPrimary: false })
    expect(t.state()).toBe('dragging')
    t.pointer('pointermove', 60)
    expect(t.provider.pointer.value?.current.x).toBe(60)
  })
})
