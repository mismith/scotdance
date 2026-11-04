// Text typed all in capitals ("MARY MACKENZIE", "12 & UNDER 14 YEARS"),
// written as it's spelled, as import reads a list. A copy of the server's
// tidying (functions/src/capitals.ts, which says how it spells), kept in step
// by a test, so System admin › Cleanup › Capitals and import agree.

/** Every word of a kind, by its lower case, in the spelling most often typed. */
export type Known = Map<string, string>

const WORD = /[\p{L}\p{M}']+/gu

/**
 * All in capitals: no small letters, and a word of 4 or more capitals ("59th"
 * aside), or short words ("MIA LEE") each typed otherwise in `same`, the
 * same kind of thing elsewhere, one of them with a capital.
 */
export function isShouting(s: unknown, same?: Known): s is string {
  if (typeof s !== 'string') return false
  const letters = s.replace(/\d+(st|nd|rd|th)\b/gi, '')
  if (/\p{Ll}/u.test(letters) || !/\p{Lu}{2}/u.test(letters)) return false
  if (/\p{Lu}{4,}/u.test(letters)) return true
  // At least one a name-like word: "ON" is only ever "on" (Niagara-on-the-Lake), so it's Ontario.
  const forms = [...letters.matchAll(WORD)].map(([w]) => [
    w,
    same?.get(w.toLowerCase()) ?? w,
  ])
  return (
    forms.every(([w, form]) => form !== w) &&
    forms.some(([, form]) => /^\p{Lu}/u.test(form))
  )
}

/** No small letters ("MIA"): a name in capitals, in a list whose names are (isShouting). */
export function allCapitals(s: unknown): s is string {
  return typeof s === 'string' && !/\p{Ll}/u.test(s) && /\p{Lu}{2}/u.test(s)
}

const SMALL = new Set([
  'and',
  'of',
  'the',
  'de',
  'du',
  'des',
  'la',
  'le',
  'van',
  'von',
  'der',
  'den',
  'da',
  'di',
])
const ROMAN = /^(i{2,3}|iv|vi{1,3}|ix|x{2,3})$/i

/**
 * Learns spellings from text typed with small letters ("ECHDA January
 * Competition" teaches ECHDA and January). Counts, so the most common wins.
 */
export function learn(
  values: Iterable<unknown>,
  into: Map<string, Map<string, number>> = new Map(),
) {
  for (const v of values) {
    if (typeof v !== 'string' || !/\p{Ll}/u.test(v)) continue
    for (const [w] of v.matchAll(WORD)) {
      if (!/\p{L}/u.test(w)) continue
      const forms = into.get(w.toLowerCase()) ?? new Map<string, number>()
      forms.set(w, (forms.get(w) ?? 0) + 1)
      into.set(w.toLowerCase(), forms)
    }
  }
  return into
}

/** The most typed spelling of each word learned. */
export function known(counts: Map<string, Map<string, number>>): Known {
  const out: Known = new Map()
  for (const [key, forms] of counts)
    out.set(key, [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0])
  return out
}

function ruleCase(word: string, first: boolean) {
  const lower = word.toLowerCase()
  if (!first && SMALL.has(lower)) return lower
  if (ROMAN.test(word) || word.length <= 2 || !/[aeiouy]/i.test(word)) return word
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (/^mc./.test(lower)) return 'Mc' + cap(lower.slice(2))
  if (/^o'./.test(lower)) return "O'" + cap(lower.slice(2))
  return cap(lower)
}

/** Text in capitals as it's spelled; anything else as it is. */
export function tidyCapitals(s: string, ...dictionaries: Known[]): string {
  return isShouting(s, dictionaries[0]) ? spelled(s, ...dictionaries) : s
}

/** Each word as it's spelled in `dictionaries` (the same kind of thing first), else by the rules. */
export function spelled(s: string, ...dictionaries: Known[]): string {
  let first = true
  return s.replace(/[\p{L}\p{M}'\d]+/gu, (w) => {
    const isFirst = first
    first = false
    if (/^\d+(st|nd|rd|th)$/i.test(w)) return w.toLowerCase()
    if (!/\p{L}/u.test(w)) return w
    // Short ones (ON, AB, A Left) only as typed in the same kind of thing,
    // and with a capital: Ed and Jo, but not "on" or "s" for ON and S.
    for (const d of w.length <= 2 ? dictionaries.slice(0, 1) : dictionaries) {
      const form = d.get(w.toLowerCase())
      if (form && (w.length > 2 || /\p{Lu}/u.test(form)))
        return isFirst && SMALL.has(form)
          ? form.charAt(0).toUpperCase() + form.slice(1)
          : form
    }
    return ruleCase(w, isFirst)
  })
}
