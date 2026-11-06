import { describe, expect, it } from 'vitest'
import { seasonLabel, seasonOf } from '@/lib/seasons'

const ms = (date: string) => new Date(`${date}T12:00:00`).getTime()

describe('seasons', () => {
  it('runs September to August, named by both years', () => {
    expect(seasonOf(ms('2025-09-01'))).toBe(2025)
    expect(seasonOf(ms('2026-03-14'))).toBe(2025)
    expect(seasonOf(ms('2025-08-31'))).toBe(2024)
    expect(seasonLabel(2025)).toBe('2025–26')
    expect(seasonLabel(1999)).toBe('1999–00')
  })
})
