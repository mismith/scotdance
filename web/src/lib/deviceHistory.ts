import { useRecentEntities } from '@/composables/useRecentEntities'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { clearSaved } from '@/lib/offline'

// What this device remembers of where you've been, for Settings › Clear
// history: recent searches, recently viewed, where each page was scrolled to
// and the last pages (to reopen where you were), and the copies kept for
// offline use. Your account, follows and settings stay.

/** Scroll positions by page address (router). */
export const SCROLL_POSITIONS_KEY = 'scroll-positions'
/** The last page of each kind, to reopen where you were (router). */
export const ROUTE_INFO_KEY = 'route-info'

const RECENT_KINDS = ['competitions', 'dancers', 'judges', 'pipers', 'venues']

export async function clearDeviceHistory() {
  useRecentSearches().clear()
  for (const kind of RECENT_KINDS) useRecentEntities(kind).clear()
  for (const key of [SCROLL_POSITIONS_KEY, ROUTE_INFO_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* private mode */
    }
  }
  await clearSaved()
}
