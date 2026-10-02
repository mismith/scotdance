import type { CompetitionListItem } from '@/composables/useCompetitions'

// The competitions number search can look in (those within a month of
// today), and how they're ordered and filtered.

export interface CompetitionChoice {
  id: string
  competition: CompetitionListItem
  /** Calendar days from today to its first day (negative = past). */
  days: number
  /** On today: every day of a multi-day competition counts. */
  today: boolean
  /** A competition you follow. */
  followed: boolean
  /** Dancers you follow who are entered (aggregate id, first name). */
  dancers: Array<{ id: string; name: string }>
  /** In the area the Competitions list is set to. */
  near: boolean
}

const isYours = (c: CompetitionChoice) => c.followed || c.dancers.length > 0

const distance = (c: CompetitionChoice) => (c.today ? 0 : Math.abs(c.days))

/**
 * Likeliest first: on today, then the nearest by days. Ties go to yours, then
 * to ones in your area, then to the earlier one.
 */
export function compareChoices(a: CompetitionChoice, b: CompetitionChoice): number {
  return (
    distance(a) - distance(b) ||
    Number(isYours(b)) - Number(isYours(a)) ||
    Number(b.near) - Number(a.near) ||
    a.days - b.days ||
    (a.competition.name ?? '').localeCompare(b.competition.name ?? '')
  )
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Every word typed is somewhere in the name, town or venue, accents aside. */
export function matches(c: CompetitionChoice, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const { name, location, venue } = c.competition
  const text = fold([name, location, venue].filter(Boolean).join(' '))
  return words.every((w) => text.includes(w))
}

export interface ChoiceSection {
  key: 'today' | 'upcoming' | 'earlier'
  label: string
  choices: CompetitionChoice[]
}

/** The full list by date: today (in the order given), coming up soonest first, then earlier, latest first. */
export function sections(choices: CompetitionChoice[]): ChoiceSection[] {
  const all: ChoiceSection[] = [
    { key: 'today', label: 'Today', choices: choices.filter((c) => c.today) },
    {
      key: 'upcoming',
      label: 'Coming up',
      choices: choices.filter((c) => !c.today && c.days > 0).sort((a, b) => a.days - b.days),
    },
    {
      key: 'earlier',
      label: 'Earlier',
      choices: choices.filter((c) => !c.today && c.days < 0).sort((a, b) => b.days - a.days),
    },
  ]
  return all.filter((s) => s.choices.length)
}
