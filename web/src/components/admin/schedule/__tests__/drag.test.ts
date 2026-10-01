import { describe, expect, it } from 'vitest'
import { adjust, insertIndex, payload } from '../drag'

/** A list of items 40px tall, from the top (happy-dom has no layout). */
function list(n: number, selector = 'li') {
  const ul = document.createElement('ul')
  for (let i = 0; i < n; i++) {
    const li = document.createElement(selector)
    li.getBoundingClientRect = () => ({ top: i * 40, height: 40, left: i * 100, width: 100 }) as DOMRect
    ul.append(li)
  }
  return ul
}

describe('insertIndex', () => {
  it('puts the drop before the first item whose middle is below the pointer', () => {
    const ul = list(3)
    expect(insertIndex(ul, 'li', -5)).toBe(0)
    expect(insertIndex(ul, 'li', 19)).toBe(0)
    expect(insertIndex(ul, 'li', 21)).toBe(1)
    expect(insertIndex(ul, 'li', 61)).toBe(2)
    expect(insertIndex(ul, 'li', 500)).toBe(3)
  })

  it('works across too, and with nothing to drop among', () => {
    expect(insertIndex(list(3), 'li', 120, 'x')).toBe(1)
    expect(insertIndex(list(0), 'li', 10)).toBe(0)
    expect(insertIndex(null, 'li', 10)).toBeUndefined()
  })
})

describe('adjust', () => {
  it('allows for the dragged item leaving its place', () => {
    // Dragging item 1 to before item 3: it lands at 2 once it's out of the way.
    expect(adjust(3, 1)).toBe(2)
    expect(adjust(0, 2)).toBe(0)
    expect(adjust(2, 2)).toBe(2)
  })
})

describe('payload', () => {
  it('wraps one item as the drag kit expects', () => {
    const d = { type: 'block', blockId: 'b', index: 2 } as const
    expect(payload(d)).toEqual([0, [d]])
  })
})
