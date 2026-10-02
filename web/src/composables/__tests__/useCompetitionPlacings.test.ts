import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { notePlacings, useFreshPlacings } from '@/composables/useCompetitionPlacings'

// A page showing one placing: says whether it rendered it as fresh.
function page(g: string, d: string, id: string) {
  return mount(
    defineComponent({
      setup() {
        const isFresh = useFreshPlacings()
        return () => h('i', isFresh(g, d, id) ? 'fresh' : '')
      },
    }),
  ).text()
}

describe('fresh placings', () => {
  it('the first read is a baseline, not news', () => {
    expect(notePlacings(null, { g1: { fling: ['a', 'b'] } })).toBe(false)
    expect(page('g1', 'fling', 'a')).toBe('')
  })

  it('a placing that arrives later is fresh until it has been shown', () => {
    vi.useFakeTimers()
    const before = { g1: { fling: ['a'] } }
    expect(notePlacings(before, { g1: { fling: ['a', 'b'], sword: false }, g2: {} })).toBe(true)
    expect(page('g1', 'fling', 'a')).toBe('')
    expect(page('g1', 'fling', 'b')).toBe('fresh')
    // Shown (and flipped): it isn't news any more, on any page.
    vi.advanceTimersByTime(1000)
    expect(page('g1', 'fling', 'b')).toBe('')
    vi.useRealTimers()
  })

  it('a changed place (a tie entered) is news too; nothing changing isn’t', () => {
    const before = { g3: { fling: ['a', 'b'] } }
    expect(notePlacings(before, { g3: { fling: ['a', 'b:tie'] } })).toBe(true)
    expect(page('g3', 'fling', 'a')).toBe('fresh')
    expect(page('g3', 'fling', 'b')).toBe('fresh')
    expect(notePlacings(before, { g3: { fling: ['a', 'b'] } })).toBe(false)
  })
})
