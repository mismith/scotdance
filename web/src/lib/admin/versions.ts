// The app versions people are asked to update to (Tools). A typo there, like
// 200.0.0, would ask everyone to update to a release that doesn't exist.

const parts = (v: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim())?.slice(1).map(Number) ?? null

/**
 * Whether a new version is worth a second look before it's saved: lower than
 * the current one, or a big jump (more than one major or minor release on).
 * Null when it looks like a normal next release, or there's nothing to compare.
 */
export function versionJump(from: string | null | undefined, to: string): 'lower' | 'big' | null {
  const a = from ? parts(from) : null
  const b = parts(to)
  if (!a || !b) return null
  const [major, minor] = [b[0] - a[0], b[1] - a[1]]
  if ((major || minor || b[2] - a[2]) < 0) return 'lower'
  if (major > 1 || (major === 0 && minor > 1)) return 'big'
  return null
}
