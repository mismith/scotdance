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
  if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  return NAME_TO_ISO[trimmed.toLowerCase()] ?? null
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

