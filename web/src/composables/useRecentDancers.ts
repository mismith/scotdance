import { useRecentEntities } from './useRecentEntities'

// Back-compat alias — predates the multi-entity generalization. New callers
// should use `useRecentEntities('dancers')` directly.
export function useRecentDancers() {
  return useRecentEntities('dancers')
}

export type { RecentEntity as RecentDancer } from './useRecentEntities'
