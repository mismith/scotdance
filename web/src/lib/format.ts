export function formatExternalURL(url: string): string {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function formatHumanURL(url: string): string {
  if (!url) return ''
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
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
  return weekday.format(new Date(value))
}

export function formatLongDate(value: number | string | undefined | null): string {
  if (value == null) return ''
  return dayMonthYear.format(new Date(value))
}

export function formatShortDate(value: number | string | undefined | null): string {
  if (value == null) return ''
  return monthDayYear.format(new Date(value))
}

export function formatDateTime(value: number | string | undefined | null): string {
  if (value == null) return ''
  return dateTimeAt.format(new Date(value)).replace(', ', ' at ')
}

export function isSameDay(
  a: number | string | undefined | null,
  b: Date = new Date(),
): boolean {
  if (a == null) return false
  const d = new Date(a)
  return (
    d.getFullYear() === b.getFullYear() &&
    d.getMonth() === b.getMonth() &&
    d.getDate() === b.getDate()
  )
}

export function isPast(value: number | string | undefined | null): boolean {
  if (value == null) return false
  return new Date(value).getTime() < Date.now()
}

const relativeTime = new Intl.RelativeTimeFormat('en-US', {
  numeric: 'auto',
  style: 'long',
})

const MS = {
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
  year: 365 * 86_400_000,
}

export function formatRelative(value: number | string | undefined | null): string {
  if (value == null) return ''
  const diff = new Date(value).getTime() - Date.now()
  const abs = Math.abs(diff)
  if (abs < MS.day) return diff > 0 ? 'Today' : 'Today'
  if (abs < MS.week) return relativeTime.format(Math.round(diff / MS.day), 'day')
  if (abs < MS.month) return relativeTime.format(Math.round(diff / MS.week), 'week')
  if (abs < MS.year) return relativeTime.format(Math.round(diff / MS.month), 'month')
  return relativeTime.format(Math.round(diff / MS.year), 'year')
}
