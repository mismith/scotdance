// ISO alpha-2 codes for the Highland-dance markets. Only auto-apply the
// country guess when it lands inside this set — a visitor from outside the
// dance world should land on "All countries", not an empty list.
const DANCE_COUNTRIES = new Set(['GB', 'IE', 'CA', 'US', 'AU', 'NZ', 'ZA'])

// IANA timezone → ISO alpha-2. Just the Highland-dance markets; anything not
// listed falls through to the locale-region fallback below.
const TZ_TO_COUNTRY: Record<string, string> = {
  'Europe/London': 'GB',
  'Europe/Belfast': 'GB',
  'Europe/Isle_of_Man': 'GB',
  'Europe/Jersey': 'GB',
  'Europe/Guernsey': 'GB',
  'Europe/Dublin': 'IE',
  'America/St_Johns': 'CA',
  'America/Halifax': 'CA',
  'America/Moncton': 'CA',
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Winnipeg': 'CA',
  'America/Regina': 'CA',
  'America/Edmonton': 'CA',
  'America/Vancouver': 'CA',
  'America/Whitehorse': 'CA',
  'America/Dawson': 'CA',
  'America/Iqaluit': 'CA',
  'America/Yellowknife': 'CA',
  'Pacific/Auckland': 'NZ',
  'Pacific/Chatham': 'NZ',
  'Africa/Johannesburg': 'ZA',
}

export function guessUserCountry(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) {
      if (TZ_TO_COUNTRY[tz]) return TZ_TO_COUNTRY[tz]
      if (tz.startsWith('Australia/')) return 'AU'
    }
  } catch { /* noop */ }

  // Fallback: locale region. Weaker — many people run en-US outside the
  // US — so only accept it when it lands in a dance market.
  try {
    const lang = navigator.language || navigator.languages?.[0]
    if (lang) {
      const region = new Intl.Locale(lang).maximize().region
      if (region && DANCE_COUNTRIES.has(region)) return region
    }
  } catch { /* noop */ }

  return null
}
