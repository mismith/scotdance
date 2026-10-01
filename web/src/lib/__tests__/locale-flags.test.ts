import { afterEach, describe, expect, it, vi } from 'vitest'
import { countryFlag, countryName, isoFor } from '@/lib/flagEmoji'
import { guessUserCountry } from '@/lib/locale'

describe('isoFor', () => {
  it.each([
    ['CA', 'CA'],
    ['ca', 'CA'],
    [' AU ', 'AU'],
    ['Canada', 'CA'],
    ['united states of america', 'US'],
    ['USA', 'US'],
    ['UK', 'GB'],
    ['uk', 'GB'],
    ['Scotland', 'GB'],
    ['Northern Ireland', 'GB'],
    ['Ireland', 'IE'],
    ['New Zealand', 'NZ'],
    ['South Africa', 'ZA'],
  ])('%j → %s', (value, iso) => {
    expect(isoFor(value)).toBe(iso)
  })

  it.each([[''], ['  '], [null], [undefined], ['Narnia'], ['C4'], ['CAN']])('%j has no code', (value) => {
    expect(isoFor(value)).toBeNull()
  })
})

describe('countryFlag', () => {
  it('turns a code or a name into its flag', () => {
    expect(countryFlag('CA')).toBe('🇨🇦')
    expect(countryFlag('Scotland')).toBe('🇬🇧')
    expect(countryFlag('UK')).toBe('🇬🇧')
  })

  it('has no flag for what it can’t place', () => {
    expect(countryFlag('Atlantis')).toBeNull()
    expect(countryFlag('')).toBeNull()
  })
})

describe('countryName', () => {
  it('spells out codes, so “CA” isn’t read as California', () => {
    const name = (code: string) => new Intl.DisplayNames(undefined, { type: 'region' }).of(code)
    expect(countryName('CA')).toBe(name('CA'))
    expect(countryName('gb')).toBe(name('GB'))
  })

  it('leaves names as they are', () => {
    expect(countryName('Scotland')).toBe('Scotland')
    expect(countryName('  Canada ')).toBe('Canada')
  })
})

describe('guessUserCountry', () => {
  const zone = (timeZone: string) =>
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat().resolvedOptions(),
      timeZone,
    })
  const language = (lang: string) => vi.spyOn(navigator, 'language', 'get').mockReturnValue(lang)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['America/Edmonton', 'CA'],
    ['America/St_Johns', 'CA'],
    ['Europe/London', 'GB'],
    ['Europe/Dublin', 'IE'],
    ['Australia/Perth', 'AU'],
    ['Pacific/Auckland', 'NZ'],
    ['Africa/Johannesburg', 'ZA'],
  ])('%s → %s', (tz, country) => {
    zone(tz)
    language('fr-FR')
    expect(guessUserCountry()).toBe(country)
  })

  it('falls back to the language’s region when it’s a dance market', () => {
    zone('America/New_York')
    language('en-US')
    expect(guessUserCountry()).toBe('US')
  })

  it('stays out of the way for everyone else', () => {
    zone('Europe/Paris')
    language('fr-FR')
    expect(guessUserCountry()).toBeNull()
  })
})
