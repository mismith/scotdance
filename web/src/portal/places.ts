/** Canada and the United States are picked from a list of provinces or states; elsewhere the region is free text. */
export const needsRegion = (country: string) => country === 'Canada' || country === 'United States'

/** "Canmore, AB" for Canada and the US, "Inverness, Scotland, United Kingdom" elsewhere. */
export function placeLabel(place: { town: string; province: string; country: string }): string {
  if (!place.town) return ''
  const tail = needsRegion(place.country) ? [place.province] : [place.province, place.country]
  return [place.town, ...tail].filter(Boolean).join(', ')
}

const SKIP = new Set(['EU', 'UN', 'EZ', 'ZZ', 'QO', 'XA', 'XB', 'AC', 'CP', 'DG', 'EA', 'IC', 'TA'])
let countries: string[] | undefined
/** Every country's English name, from the browser's own list of ISO codes. Canada first. */
export function countryNames(): string[] {
  if (countries) return countries
  const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
  const found = new Set<string>()
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const a of letters)
    for (const b of letters) {
      const code = a + b
      const name = SKIP.has(code) ? undefined : names.of(code)
      if (name && name !== code) found.add(name)
    }
  found.add('Canada')
  const rest = [...found].filter((n) => n !== 'Canada').sort((x, y) => x.localeCompare(y))
  return (countries = ['Canada', ...rest])
}

export const PROVINCES: Array<{ code: string; name: string }> = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
]

export const STATES: Array<{ code: string; name: string }> = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
].map(([code, name]) => ({ code: code!, name: name! }))
