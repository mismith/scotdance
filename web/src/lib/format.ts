export function formatExternalURL(url: string): string {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function formatHumanURL(url: string): string {
  if (!url) return ''
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
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

const dayMonthYear = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const monthDayYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const dateTimeAt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' })

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
  return dateTimeAt.format(parseDate(value)).replace(', ', ' at ')
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

const relativeTime = new Intl.RelativeTimeFormat('en-US', {
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
