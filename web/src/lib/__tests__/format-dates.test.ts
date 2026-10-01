import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  daysFromToday,
  formatDateTime,
  formatExternalURL,
  formatHumanURL,
  formatLongDate,
  formatMonthAbbrev,
  formatMonthYear,
  formatRelative,
  formatShortDate,
  formatWeekday,
  formatWeekdayShortDate,
  initialsOf,
  isBeforeToday,
  isPast,
  isSameDay,
  parseDate,
} from '@/lib/format'

// Dates arrive in every shape the old and new admins wrote: 'YYYY-MM-DD',
// ISO instants with and without a zone, ms numbers (sometimes as strings),
// and legacy blanks (''). Local-time constructors keep these tests true in
// any timezone.

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)
const setNow = (d: Date) => vi.setSystemTime(d)
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'long' })

beforeEach(() => {
  vi.useFakeTimers()
  setNow(at(2026, 10, 1, 10, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('parseDate', () => {
  it('reads YYYY-MM-DD as local midnight, not UTC', () => {
    expect(parseDate('2019-01-22').getTime()).toBe(at(2019, 1, 22).getTime())
  })

  it('reads an ISO instant as that instant', () => {
    const d = at(2018, 7, 2, 0, 0)
    expect(parseDate(d.toISOString()).getTime()).toBe(d.getTime())
  })

  it('reads an ISO date-time without a zone as local time', () => {
    expect(parseDate('2018-12-12T09:00').getTime()).toBe(at(2018, 12, 12, 9, 0).getTime())
  })

  it('reads ms timestamps, as numbers or as the strings the old admin saved', () => {
    const ms = at(2019, 1, 14, 8).getTime()
    expect(parseDate(ms).getTime()).toBe(ms)
    expect(parseDate(String(ms)).getTime()).toBe(ms)
  })

  it('passes a Date through', () => {
    const d = at(2026, 10, 1)
    expect(parseDate(d)).toBe(d)
  })
})

describe('missing and unreadable dates', () => {
  it.each([[''], ['TBD'], ['not a date'], ['2019-13-45'], ['2019-13-45T99:99'], [NaN], [null], [undefined]])('%j formats as nothing', (value) => {
    const v = value as string | number | null | undefined
    expect(formatWeekday(v)).toBe('')
    expect(formatLongDate(v)).toBe('')
    expect(formatShortDate(v)).toBe('')
    expect(formatDateTime(v)).toBe('')
    expect(formatMonthYear(v)).toBe('')
    expect(formatWeekdayShortDate(v)).toBe('')
    expect(formatMonthAbbrev(v)).toBe('')
    expect(formatRelative(v)).toBe('')
  })

  it.each([[''], ['TBD'], ['not a date'], [NaN], [null], [undefined]])('%j is never today, past or a day count', (value) => {
    const v = value as string | number | null | undefined
    expect(daysFromToday(v)).toBeNull()
    expect(isSameDay(v)).toBe(false)
    expect(isPast(v)).toBe(false)
    expect(isBeforeToday(v)).toBe(false)
  })
})

describe('days from today', () => {
  it('counts calendar days, whatever the time of day', () => {
    expect(daysFromToday('2026-10-01')).toBe(0)
    expect(daysFromToday('2026-10-02')).toBe(1)
    expect(daysFromToday('2026-09-30')).toBe(-1)
    expect(daysFromToday(at(2026, 10, 1, 23, 59).getTime())).toBe(0)
    expect(daysFromToday(at(2026, 10, 2, 0, 1).toISOString())).toBe(1)
  })

  it('a minute before midnight, tomorrow is still tomorrow', () => {
    setNow(at(2026, 10, 1, 23, 59))
    expect(daysFromToday('2026-10-01')).toBe(0)
    expect(daysFromToday('2026-10-02')).toBe(1)
    expect(isSameDay('2026-10-01')).toBe(true)
  })

  it('a minute after midnight, yesterday is in the past', () => {
    setNow(at(2026, 10, 2, 0, 1))
    expect(daysFromToday('2026-10-01')).toBe(-1)
    expect(isBeforeToday('2026-10-01')).toBe(true)
    expect(isSameDay('2026-10-01')).toBe(false)
    expect(isSameDay('2026-10-02')).toBe(true)
  })

  it('counts across a daylight-saving change', () => {
    setNow(at(2026, 3, 7, 12))
    expect(daysFromToday('2026-03-09')).toBe(2)
    setNow(at(2026, 10, 31, 12))
    expect(daysFromToday('2026-11-02')).toBe(2)
  })

  it('a competition today is not before today, but its start time can be past', () => {
    expect(isBeforeToday('2026-10-01')).toBe(false)
    expect(isPast(at(2026, 10, 1, 9).getTime())).toBe(true)
    expect(isPast(at(2026, 10, 1, 11).getTime())).toBe(false)
  })
})

describe('formatRelative', () => {
  it.each([
    ['2026-10-01', 0, 'day'],
    ['2026-10-02', 1, 'day'],
    ['2026-09-30', -1, 'day'],
    ['2026-10-04', 3, 'day'],
    ['2026-10-08', 1, 'week'],
    ['2026-10-22', 3, 'week'],
    ['2026-12-01', 2, 'month'],
    ['2026-08-01', -2, 'month'],
    ['2027-10-01', 1, 'year'],
    ['2019-01-14', -8, 'year'],
  ] as const)('%s is %i %s(s) away', (date, n, unit) => {
    expect(formatRelative(date)).toBe(rtf.format(n, unit))
  })
})

describe('formatters', () => {
  it('format a date-only value on its own day in every format', () => {
    const d = at(2019, 1, 22)
    expect(formatLongDate('2019-01-22')).toBe(
      new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(d),
    )
    expect(formatShortDate('2019-01-22')).toBe(
      new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d),
    )
    expect(formatWeekday('2019-01-22')).toBe(new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(d))
    expect(formatMonthAbbrev(d)).toBe(new Intl.DateTimeFormat(undefined, { month: 'short' }).format(d))
  })
})

describe('URLs', () => {
  it.each([
    // Bare hosts, as organisers type them, get https://.
    ['www.google.com', 'https://www.google.com'],
    ['highlandinstyle.ca', 'https://highlandinstyle.ca'],
    ['  highlandinstyle.ca/entries ', 'https://highlandinstyle.ca/entries'],
    ['www.example.com:8080/x', 'https://www.example.com:8080/x'],
    ['//test.com', 'https://test.com'],
    // Anything with a scheme, or a path on this site, stays as it is.
    ['http://dsadsa', 'http://dsadsa'],
    ['HTTPS://example.com', 'HTTPS://example.com'],
    ['mailto:test@scotdance.app', 'mailto:test@scotdance.app'],
    ['tel:+14035550100', 'tel:+14035550100'],
    ['/#/competitions/-LVq9g31h6ubjR_oeN1V/info', '/#/competitions/-LVq9g31h6ubjR_oeN1V/info'],
    ['/policies', '/policies'],
    ['', ''],
    // Other schemes are no link at all.
    ['javascript:alert(1)', ''],
    [' JavaScript:alert(1)', ''],
    ['data:text/html,<b>x</b>', ''],
  ])('link %j → %j', (url, href) => {
    expect(formatExternalURL(url)).toBe(href)
  })

  it.each([
    ['https://highlandinstyle.ca/', 'highlandinstyle.ca'],
    ['http://www.example.com/entries/', 'www.example.com/entries'],
    ['//test.com', 'test.com'],
    ['mailto:test@scotdance.app', 'test@scotdance.app'],
    ['www.google.com', 'www.google.com'],
    ['', ''],
  ])('shows %j as %j', (url, label) => {
    expect(formatHumanURL(url)).toBe(label)
  })
})

describe('initialsOf', () => {
  it.each([
    ['Isla MacDonald', 'IM'],
    ['  isla   macdonald  ', 'IM'],
    ['Madonna', 'M'],
    ['Mary Kate O’Neill', 'MO'],
    ['Ó Briain', 'ÓB'],
    ['', '?'],
    ['   ', '?'],
  ])('%j → %s', (name, out) => {
    expect(initialsOf(name)).toBe(out)
  })
})
