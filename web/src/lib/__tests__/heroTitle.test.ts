import { describe, expect, it } from 'vitest'
import { heroTitle } from '@/lib/heroTitle'

describe('heroTitle', () => {
  it('keeps an ordinary name at hero size', () => {
    expect(heroTitle('Red Deer Highland Games')).toBe('text-hero break-words')
    expect(heroTitle(null)).toBe('text-hero break-words')
  })
  it('takes a size down for a long name, or a word too long for a phone', () => {
    expect(heroTitle('Canada’s Capital City Championship and Pre-Premier')).toMatch(/^text-\[1\.5rem\]/)
    expect(heroTitle('Primary/Beginner/Novice')).toMatch(/^text-\[1\.5rem\]/)
  })
})
