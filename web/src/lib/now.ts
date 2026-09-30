// The app's idea of "today". In development and emulator builds, append
// `?now=2019-01-14` to any URL to pretend it's that day (kept for the
// session), so competition-day screens can be exercised against old data.
// `?now=` with no value clears it. Production builds ignore the override.

const KEY = 'dev:now'
const devBuild = import.meta.env.DEV || import.meta.env.MODE === 'emulator'

function readOverride(): number | null {
  if (!devBuild || typeof window === 'undefined') return null
  try {
    const param = new URLSearchParams(window.location.search).get('now')
    if (param !== null) {
      if (!param) {
        sessionStorage.removeItem(KEY)
        return null
      }
      const [y, m, d] = param.split('-').map(Number)
      if (y && m && d) {
        // Mid-morning, so "today" logic lands mid-competition.
        const t = new Date(y, m - 1, d, 10, 42).getTime()
        sessionStorage.setItem(KEY, String(t))
        return t
      }
    }
    const saved = sessionStorage.getItem(KEY)
    return saved ? Number(saved) : null
  } catch {
    return null
  }
}

const override = readOverride()
const offset = override != null ? override - Date.now() : 0

export const isTimeOverridden = override != null

export function nowMs(): number {
  return Date.now() + offset
}

export function now(): Date {
  return new Date(nowMs())
}
