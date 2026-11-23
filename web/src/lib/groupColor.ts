import { solidOf } from '@/lib/tartan'

/**
 * The colour of a row about your dancers, for `--dc` (the stripe and its
 * wash, `dancer-sash`). One dancer: theirs (or their tartan's cloth). Several
 * together (a "9 dancers" line, an age group with two of yours): a rainbow
 * of their colours from top to bottom, so the stripe at the left carries
 * every one and the wash fades out from it.
 */
export function groupColor(colors: ReadonlyArray<string | null | undefined>): string | undefined {
  if (!colors.length) return undefined
  if (colors.length === 1) return colors[0] ?? 'var(--primary)'
  const solids = colors.map((c) => solidOf(c) ?? 'var(--primary)')
  return `linear-gradient(180deg, ${solids.join(', ')})`
}
