// Highland dancing's seasons run September to August, so a dancer's
// competitions are grouped by season, not calendar year.

/**
 * The season a date falls in, by the year it starts: October 2025 and
 * March 2026 are both the 2025–26 season.
 */
export const seasonOf = (ms: number) => {
  const d = new Date(ms)
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
}
/** "2025–26" for the season starting in 2025. */
export const seasonLabel = (start: number) => `${start}–${String(start + 1).slice(-2)}`
