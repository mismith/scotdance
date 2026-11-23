/**
 * Your dancers, named while there are few: "Isla", "Isla and Skye", then
 * "Your 3 dancers". First names, or whole ones where two share a first name.
 */
export function dancersLabel(names: readonly string[]): string {
  const firsts = names.map((n) => n.trim().split(/\s+/)[0] ?? n)
  const shown = names.map((n, i) => (firsts.indexOf(firsts[i]) !== firsts.lastIndexOf(firsts[i]) ? n : firsts[i]))
  if (names.length === 1) return shown[0]
  if (names.length === 2) return `${shown[0]} and ${shown[1]}`
  return `Your ${names.length} dancers`
}
