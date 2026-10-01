import { describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { backLabelFor, recordBackLabel } from '@/lib/backLabels'
import { backPath, goUp } from '@/lib/back'
import { buildTitle } from '@/composables/usePageTitle'
import { groupByVenue } from '@/lib/venues'
import type { CompetitionListItem } from '@/composables/useCompetitions'

describe('back labels', () => {
  it('names a page by the first part of its title', () => {
    recordBackLabel('/competitions/x/results', 'Results • Nationals • ScotDance.app')
    expect(backLabelFor('/competitions/x/results')).toBe('Results')
  })

  it('ignores the bare app title and blanks', () => {
    recordBackLabel('/a', 'ScotDance.app')
    recordBackLabel('/b', '   ')
    expect(backLabelFor('/a')).toBe('Back')
    expect(backLabelFor('/b')).toBe('Back')
  })

  it('says Back when it doesn’t know', () => {
    expect(backLabelFor(null)).toBe('Back')
    expect(backLabelFor('/never-seen')).toBe('Back')
  })

  it('survives a reload (kept for the session)', () => {
    recordBackLabel('/judges', 'Judges • ScotDance.app')
    expect(JSON.parse(sessionStorage.getItem('back-labels') ?? '{}')['/judges']).toBe('Judges')
  })

  it('keeps only the most recent pages', () => {
    for (let i = 0; i < 70; i++) recordBackLabel(`/page/${i}`, `Page ${i} • ScotDance.app`)
    expect(backLabelFor('/page/69')).toBe('Page 69')
    expect(backLabelFor('/page/0')).toBe('Back')
    expect(Object.keys(JSON.parse(sessionStorage.getItem('back-labels') ?? '{}')).length).toBeLessThanOrEqual(60)
  })

  it('reads where browser-back goes from the router’s history state', () => {
    history.replaceState({ back: '/competitions' }, '')
    expect(backPath()).toBe('/competitions')
    history.replaceState(null, '')
    expect(backPath()).toBeNull()
  })
})

describe('goUp', () => {
  const fakeRouter = () =>
    ({
      resolve: (to: { name: string }) => ({ path: to.name === 'judges' ? '/judges' : '/' }),
      back: vi.fn(),
      replace: vi.fn(),
    }) as unknown as Router & { back: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> }

  it('steps back when the page before is the one it goes up to', () => {
    const router = fakeRouter()
    history.replaceState({ back: '/judges?q=ail' }, '')
    goUp(router, { name: 'judges' })
    expect(router.back).toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('otherwise replaces this page, so the browser’s Back can’t bounce down again', () => {
    const router = fakeRouter()
    history.replaceState({ back: '/search' }, '')
    goUp(router, { name: 'judges' })
    history.replaceState(null, '')
    goUp(router, { name: 'judges' })
    expect(router.back).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledTimes(2)
  })
})

describe('buildTitle', () => {
  it.each([
    [[], 'ScotDance.app'],
    [[null, undefined, '  '], 'ScotDance.app'],
    [['Search'], 'Search • ScotDance.app'],
    [['Results', 'Nationals'], 'Results • Nationals • ScotDance.app'],
    [['About ScotDance.app'], 'About • ScotDance.app'],
    [['  Judges  '], 'Judges • ScotDance.app'],
  ])('%j → %s', (parts, title) => {
    expect(buildTitle(parts)).toBe(title)
  })
})

describe('groupByVenue (map pins)', () => {
  const comp = (id: string, venue: string | undefined, lat: number | undefined, lng: number | undefined) =>
    ({ id, name: id, venue, lat, lng }) as CompetitionListItem

  it('puts competitions at the same venue on one pin', () => {
    const groups = groupByVenue([
      comp('a', 'Telus Convention Centre', 51.0446, -114.0617),
      comp('b', 'TELUS Convention Centre.', 51.04461, -114.06171),
      comp('c', 'Convention Centre Telus', 51.0446, -114.0617),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].competitions.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps same-named venues in different places apart', () => {
    expect(groupByVenue([comp('a', 'Civic Centre', 51.04, -114.06), comp('b', 'Civic Centre', 45.42, -75.69)])).toHaveLength(2)
  })

  it('keeps different venues at the same spot apart', () => {
    expect(groupByVenue([comp('a', 'Hall A', 51.04, -114.06), comp('b', 'Hall B', 51.04, -114.06)])).toHaveLength(2)
  })

  it('leaves out competitions it can’t place', () => {
    expect(groupByVenue([comp('a', 'Somewhere', undefined, undefined), comp('b', 'Nowhere', NaN, 3)])).toEqual([])
  })
})
