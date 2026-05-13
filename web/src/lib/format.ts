export function formatExternalURL(url: string): string {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function formatHumanURL(url: string): string {
  if (!url) return ''
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
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
 * - Numbers (ms epoch — registration timestamps) and other strings fall
 *   through to the standard `Date` constructor.
 */
export function parseDate(value: number | string | Date): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
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
  if (value == null) return ''
  return weekday.format(parseDate(value))
}

export function formatLongDate(value: number | string | undefined | null): string {
  if (value == null) return ''
  return dayMonthYear.format(parseDate(value))
}

export function formatShortDate(value: number | string | undefined | null): string {
  if (value == null) return ''
  return monthDayYear.format(parseDate(value))
}

export function formatDateTime(value: number | string | undefined | null): string {
  if (value == null) return ''
  return dateTime.format(parseDate(value))
}

export function formatMonthYear(value: number | string | Date | undefined | null): string {
  if (value == null) return ''
  return monthYear.format(value instanceof Date ? value : parseDate(value))
}

export function formatWeekdayShortDate(
  value: number | string | Date | undefined | null,
): string {
  if (value == null) return ''
  return weekdayShortDate.format(value instanceof Date ? value : parseDate(value))
}

export function formatMonthAbbrev(value: number | string | Date | undefined | null): string {
  if (value == null) return ''
  return monthAbbrev.format(value instanceof Date ? value : parseDate(value))
}

export function isSameDay(
  a: number | string | undefined | null,
  b: Date = new Date(),
): boolean {
  if (a == null) return false
  return calendarDayDiff(parseDate(a), b) === 0
}

/**
 * Strict instant-in-the-past check (millisecond precision). Use for
 * timestamped events like registrationStart/registrationEnd. For
 * date-only comp dates use {@link isBeforeToday}.
 */
export function isPast(value: number | string | undefined | null): boolean {
  if (value == null) return false
  return parseDate(value).getTime() < Date.now()
}

/**
 * Calendar-aware "is this date strictly before today's local date".
 * Today's comp returns false (it's not past, it's happening); yesterday
 * and earlier returns true.
 */
export function isBeforeToday(value: number | string | undefined | null): boolean {
  if (value == null) return false
  return calendarDayDiff(parseDate(value), new Date()) < 0
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
  style: 'long',
})

export function formatRelative(value: number | string | undefined | null): string {
  if (value == null) return ''
  const days = calendarDayDiff(parseDate(value), new Date())
  const abs = Math.abs(days)
  if (abs < 7) return relativeTime.format(days, 'day')
  if (abs < 30) return relativeTime.format(Math.round(days / 7), 'week')
  if (abs < 365) return relativeTime.format(Math.round(days / 30), 'month')
  return relativeTime.format(Math.round(days / 365), 'year')
}
