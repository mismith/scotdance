import { describe, expect, it } from 'vitest'
import { splitMembers, splitName } from '@/lib/admin/memberNames'

// Made-up names, typed the ways production has them.

describe('splitMembers', () => {
  it('splits on commas, ampersands, "and", slashes and lines', () => {
    expect(splitMembers('Isla Grant & Mairi Shaw, Ava Ross and Skye Munro / Eilidh Bain\nKirsty Gow').names).toEqual([
      'Isla Grant',
      'Mairi Shaw',
      'Ava Ross',
      'Skye Munro',
      'Eilidh Bain',
      'Kirsty Gow',
    ])
  })

  it('keeps alternates as dancers, last, and leaves out ages', () => {
    expect(splitMembers('Isla Grant and Ava Ross (Alternate) & Mairi Shaw')).toEqual({ names: ['Isla Grant', 'Mairi Shaw', 'Ava Ross'], leftOut: [], alternates: 1 })
    const last = (s: string) => splitMembers(s).names.at(-1)
    expect(last('Isla Grant, Mairi Shaw (Alt. Ava Ross)')).toBe('Ava Ross')
    expect(last('Isla Grant & Mairi Shaw (Ava Ross alt.)')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw (Alt.Ava Ross)')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw, Ava Ross (alt)')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw, Ava Ross - alt')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw, alt: Ava Ross')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw. Alt, dancer: Ava')).toBe('Ava')
    // Alt is a surname too.
    expect(splitMembers('Isla Alt, Mairi Shaw & Ava Alt')).toEqual({ names: ['Isla Alt', 'Mairi Shaw', 'Ava Alt'], leftOut: [], alternates: 0 })
    expect(splitMembers('Isla Grant, Mairi Shaw 17, Ava Ross')).toEqual({ names: ['Isla Grant', 'Mairi Shaw', 'Ava Ross'], leftOut: ['An age after Mairi Shaw'], alternates: 0 })
  })
})

describe('splitName', () => {
  it('splits as the dancer import does: first word, then the rest', () => {
    expect(splitName('Isla Jean Grant')).toEqual({ firstName: 'Isla', lastName: 'Jean Grant' })
    expect(splitName('Grant, Isla')).toEqual({ firstName: 'Isla', lastName: 'Grant' })
    expect(splitName('Isla')).toEqual({ firstName: 'Isla', lastName: '' })
  })
})
