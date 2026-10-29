// How many places a blank results grid has room for. The RSOBHD leaves
// places outside championships to the organiser (Organisers' Handbook, Dec
// 2019, §7.1); championships and premierships place six, and points stop at
// sixth. So six by default (never more than there are dancers), half the
// dancers up to six as Edmonton awards medals, or up to ten as the SDCCS
// prints for its big age groups.

export type PlacesRule = 'six' | 'half' | 'ten'

export const PLACES_RULES: ReadonlyArray<{ value: PlacesRule; label: string }> = [
  { value: 'six', label: 'Up to 6' },
  { value: 'half', label: 'Half, up to 6' },
  { value: 'ten', label: 'Up to 10' },
]

export function placesFor(dancers: number, rule: PlacesRule = 'six'): number {
  const n = Math.max(0, Math.floor(dancers))
  if (rule === 'half') return Math.min(Math.ceil(n / 2), 6)
  return Math.min(n, rule === 'ten' ? 10 : 6)
}
