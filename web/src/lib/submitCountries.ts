import { countryFlag, countryName } from '@/lib/flagEmoji'

// Where a competition is, as Submit asks it: a country, with the UK's four
// nations as their own choices (dancers there say Scotland, not the UK). A
// nation is stored as the UK's code with the nation as its region, as the
// venue search would put it.

export interface CountryChoice {
  /** ISO 3166-1 (CA), or ISO 3166-2 for a UK nation (GB-SCT). */
  code: string
  /** The country's own code: GB for every UK nation. */
  iso: string
  /** The nation, for the UK's (as a competition's region). */
  region: string | null
  name: string
  flag: string
}

// Black flag, then the subdivision's tag letters, then cancel: how emoji
// spell Scotland's, England's and Wales's flags.
const tagFlag = (sub: string) =>
  `\u{1F3F4}${[...sub].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join('')}\u{E007F}`

const NATIONS: Record<string, { name: string; flag: string }> = {
  'GB-SCT': { name: 'Scotland', flag: tagFlag('gbsct') },
  'GB-ENG': { name: 'England', flag: tagFlag('gbeng') },
  'GB-WLS': { name: 'Wales', flag: tagFlag('gbwls') },
  // No flag of its own in emoji.
  'GB-NIR': { name: 'Northern Ireland', flag: countryFlag('GB') ?? '' },
}

export function countryChoice(code: string): CountryChoice {
  const nation = NATIONS[code]
  if (nation) return { code, iso: 'GB', region: nation.name, ...nation }
  return {
    code,
    iso: code,
    region: null,
    name: countryName(code),
    flag: countryFlag(code) ?? '',
  }
}

/** The ones listed up front, where Highland dancing competes: A to Z. */
export const FEATURED = ['AU', 'CA', 'GB-ENG', 'NZ', 'GB-SCT', 'ZA', 'US']
  .map(countryChoice)
  .sort((a, b) => a.name.localeCompare(b.name))

// Every ISO 3166-1 code, for "Another country". GB is there as the UK, for
// anyone who'd rather not say which nation.
const ISO =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF YE YT ZA ZM ZW'.split(
    ' ',
  )

let all: CountryChoice[] | null = null
/** Every country and UK nation, A to Z, for searching. */
export function allCountries(): CountryChoice[] {
  all ??= [...ISO, ...Object.keys(NATIONS)]
    .map(countryChoice)
    .sort((a, b) => a.name.localeCompare(b.name))
  return all
}

/**
 * The one to start on: the country chosen on Competitions (or guessed there
 * from the phone). The UK's only when its nation is known, since Scotland and
 * England are separate choices.
 */
export function defaultCountry(
  country: string | null | undefined,
  region: string | null | undefined,
): string | null {
  if (!country) return null
  if (country !== 'GB') return countryChoice(country).name === country ? null : country
  const nation = Object.entries(NATIONS).find(
    ([, n]) => n.name.toLowerCase() === (region ?? '').toLowerCase(),
  )
  return nation ? nation[0] : null
}

/** Who registers competitions there, and what a number looks like. */
export function registrationHint(code: string | null): {
  body: string
  example: string | null
} {
  const iso = code ? countryChoice(code).iso : null
  if (iso === 'CA') return { body: 'ScotDance Canada', example: 'C-AB-CO-27-1234' }
  if (iso === 'US') return { body: 'ScotDance USA', example: 'USSE-1234' }
  if (iso === 'AU')
    return { body: 'the ABHDI or your state’s committee', example: 'C27/1234' }
  return { body: 'the RSOBHD', example: null }
}

/** A town as it's written there, and whether to add the province or state. */
export function townHint(code: string | null): {
  example: string | null
  hint: string | null
} {
  const iso = code ? countryChoice(code).iso : null
  if (iso === 'CA') return { example: 'Calgary, AB', hint: 'Include the province.' }
  if (iso === 'US') return { example: 'Albany, NY', hint: 'Include the state.' }
  if (iso === 'AU') return { example: 'Ballarat, VIC', hint: 'Include the state.' }
  if (code === 'GB-SCT') return { example: 'Dunoon', hint: null }
  if (code === 'NZ') return { example: 'Dunedin', hint: null }
  return { example: null, hint: null }
}

/** An example name, in the empty field. */
export function nameExample(code: string | null): string {
  const iso = code ? countryChoice(code).iso : null
  if (iso === 'CA') return 'e.g. Calgary Highland Games'
  if (iso === 'US') return 'e.g. Stone Mountain Highland Games'
  if (code === 'GB-SCT') return 'e.g. Cowal Highland Gathering'
  if (iso === 'AU') return 'e.g. Victorian Championships'
  return 'e.g. Spring Open Competition'
}
