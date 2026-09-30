import { ref } from 'vue'

// Back buttons say where they go ("‹ Results", not a bare chevron). The label
// for a page is the first segment of its document title, captured as the user
// leaves it — by then async data has settled the title (e.g. a dancer's name).
// Kept in sessionStorage so labels survive a reload mid-session.

const KEY = 'back-labels'
const SEP = ' • '
const MAX = 60

function read(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

const labels = ref<Record<string, string>>(read())

export function recordBackLabel(fullPath: string, title: string) {
  const label = title.split(SEP)[0]?.trim()
  if (!label || label === 'ScotDance.app') return
  const next = { ...labels.value, [fullPath]: label }
  const keys = Object.keys(next)
  if (keys.length > MAX) delete next[keys[0]]
  labels.value = next
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
}

export function backLabelFor(fullPath: string | null): string {
  if (!fullPath) return 'Back'
  return labels.value[fullPath] ?? 'Back'
}
