async function sha256Hex(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Whether an image loads, once per address: Gravatar answers 404 (d=404)
// when someone has no picture, so callers show initials instead of a
// generated pattern.
const probes = new Map<string, Promise<string | null>>()
function loads(url: string): Promise<string | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null)
  let p = probes.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(url)
      img.onerror = () => {
        // Offline is not "no picture": ask again next time.
        probes.delete(url)
        resolve(null)
      }
      img.src = url
    })
    probes.set(url, p)
  }
  return p
}

/** Someone's Gravatar picture, or null when they haven't set one (show their initials). */
export async function gravatarUrl(
  email: string | null | undefined,
  size = 200,
): Promise<string | null> {
  if (!email) return null
  const hash = await sha256Hex(email.trim().toLowerCase())
  return loads(`https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`)
}
