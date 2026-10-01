// Maps the country names that actually appear in the competition data to
// ISO 3166-1 alpha-2 codes. Aliases (UK, Scotland, England, etc.) collapse
// onto the same flag. Image-based flags can later swap in behind countryFlag.
const NAME_TO_ISO: Record<string, string> = {
  canada: 'CA',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  us: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  britain: 'GB',
  scotland: 'GB',
  england: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  ireland: 'IE',
  australia: 'AU',
  'new zealand': 'NZ',
  'south africa': 'ZA',
}

export function isoFor(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Names first, so "UK" (not an ISO code) becomes GB rather than a broken flag.
  const named = NAME_TO_ISO[trimmed.toLowerCase()]
  if (named) return named
  return /^[A-Za-z]{2}$/.test(trimmed) ? trimmed.toUpperCase() : null
}

function isoToEmoji(iso: string): string {
  return [...iso.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

export function countryFlag(country: string | null | undefined): string | null {
  const iso = isoFor(country)
  return iso ? isoToEmoji(iso) : null
}

/** A country as people say it ("CA" → "Canada"); names come back as given. */
export function countryName(country: string): string {
  const c = country.trim()
  if (!/^[A-Za-z]{2}$/.test(c)) return c
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(c.toUpperCase()) ?? c
  } catch {
    return c
  }
}
