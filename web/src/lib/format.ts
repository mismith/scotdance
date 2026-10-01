import { now, nowMs } from '@/lib/now'

/**
 * A link organisers typed, ready for an href: a bare host ("www.site.com",
 * "//site.com") gets https://; a web, mailto: or tel: link, or a path on this
 * site ("/#/competitions/…"), stays as it is. Any other scheme
 * (javascript:, data:) is no link at all.
 */
export function formatExternalURL(url: string): string {
  const u = url?.trim()
  if (!u) return ''
  if (u.startsWith('//')) return `https:${u}`
  if (u.startsWith('/')) return u
  if (/^[a-z][a-z0-9+-]*:/i.test(u)) return /^(https?|mailto|tel):/i.test(u) ? u : ''
  return `https://${u}`
}

/** A link as people read it: no scheme, no trailing slash. */
export function formatHumanURL(url: string): string {
  if (!url) return ''
  return url.trim().replace(/^(https?:)?\/\/|^(mailto|tel):/i, '').replace(/\/$/, '')
}

// First + last word initial. "John Doe" → "JD", "Madonna" → "M", "" → "?".
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]?.toUpperCase() ?? ''
  const last = parts.length > 1 ? (parts.at(-1)?.[0]?.toUpperCase() ?? '') : ''
  return `${first}${last}` || '?'
}

const MS_PER_DAY = 86_400_000

/**
 * Parse a competition-style date value into a Date in the local timezone.
 *
 * - "YYYY-MM-DD" strings (the comp.date wire format in RTDB) are parsed as
 *   LOCAL midnight, not UTC midnight. `new Date("2026-05-09")` would give
 *   UTC midnight = previous evening in Western timezones, breaking every
 *   downstream comparison and formatter.
 * - Numbers (ms epoch — registration timestamps), including ones the old
 *   admin saved as strings, are instants.
 * - Other strings fall through to the standard `Date` constructor. Anything
 *   unreadable (e.g. legacy `''`) gives an Invalid Date: see {@link validDate}.
 */
export function parseDate(value: number | string | Date): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    // No rolling '2019-13-45' over into 2020: it isn't a date.
    return date.getMonth() === m - 1 && date.getDate() === d ? date : new Date(NaN)
  }
  if (typeof value === 'string' && /^\d{10,}$/.test(value)) return new Date(Number(value))
  return new Date(value)
}

/** parseDate, or null for nothing, `''` and anything unreadable. */
function validDate(value: number | string | Date | undefined | null): Date | null {
  if (value == null || value === '') return null
  const d = parseDate(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Calendar-day delta between two dates (positive = `a` after `b`). */
function calendarDayDiff(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY,
  )
}

// Locale is undefined on purpose — Intl falls back to the host (browser /
// Capacitor WebView) locale, which is what the user expects on their device.
const dayMonthYear = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const monthDayYear = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

// Combined date+time uses the locale's native joiner — Intl picks the
// separator (comma, "at", "à", etc.) that matches the host locale.
const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' })

const monthYear = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
})

const weekdayShortDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const monthAbbrev = new Intl.DateTimeFormat(undefined, { month: 'short' })

export function formatWeekday(value: number | string | undefined | null): string {
  const d = validDate(value)
  return d ? weekday.format(d) : ''
}

export function formatLongDate(value: number | string | undefined | null): string {
  const d = validDate(value)
  return d ? dayMonthYear.format(d) : ''
}

export function formatShortDate(value: number | string | undefined | null): string {
  const d = validDate(value)
  return d ? monthDayYear.format(d) : ''
}

export function formatDateTime(value: number | string | undefined | null): string {
  const d = validDate(value)
  return d ? dateTime.format(d) : ''
}

export function formatMonthYear(value: number | string | Date | undefined | null): string {
  const d = validDate(value)
  return d ? monthYear.format(d) : ''
}

export function formatWeekdayShortDate(
  value: number | string | Date | undefined | null,
): string {
  const d = validDate(value)
  return d ? weekdayShortDate.format(d) : ''
}

export function formatMonthAbbrev(value: number | string | Date | undefined | null): string {
  const d = validDate(value)
  return d ? monthAbbrev.format(d) : ''
}

export function isSameDay(
  a: number | string | undefined | null,
  b: Date = now(),
): boolean {
  const d = validDate(a)
  return d ? calendarDayDiff(d, b) === 0 : false
}

/**
 * Strict instant-in-the-past check (millisecond precision). Use for
 * timestamped events like registrationStart/registrationEnd. For
 * date-only comp dates use {@link isBeforeToday}.
 */
export function isPast(value: number | string | undefined | null): boolean {
  const d = validDate(value)
  return d ? d.getTime() < nowMs() : false
}

/**
 * Calendar-aware "is this date strictly before today's local date".
 * Today's comp returns false (it's not past, it's happening); yesterday
 * and earlier returns true.
 */
export function isBeforeToday(value: number | string | undefined | null): boolean {
  const d = validDate(value)
  return d ? calendarDayDiff(d, now()) < 0 : false
}

/** Calendar days from today (negative = past, 0 = today, positive = future); null when there's no date. */
export function daysFromToday(value: number | string | undefined | null): number | null {
  const d = validDate(value)
  return d ? calendarDayDiff(d, now()) : null
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
  style: 'long',
})

export function formatRelative(value: number | string | undefined | null): string {
  const d = validDate(value)
  if (!d) return ''
  const days = calendarDayDiff(d, now())
  const abs = Math.abs(days)
  if (abs < 7) return relativeTime.format(days, 'day')
  if (abs < 30) return relativeTime.format(Math.round(days / 7), 'week')
  if (abs < 365) return relativeTime.format(Math.round(days / 30), 'month')
  return relativeTime.format(Math.round(days / 365), 'year')
}
