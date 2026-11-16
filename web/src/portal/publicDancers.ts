// Public data only. Do not send Connect cookies, tokens, birthdays or locations.
import { normalizeName } from '../../../shared/normalize'
export interface PublicDancer { id: string; name: string }
export async function findPublicDancers(name: string, signal?: AbortSignal): Promise<PublicDancer[]> {
  if (import.meta.env.DEV) return normalizeName(name) === 'isla fraser' ? [{ id: 'fictional-public-isla', name: 'Isla Fraser' }] : []
  const response = await fetch('https://us-central1-firebase-scotdance.cloudfunctions.net/searchAll', {
    method: 'POST', credentials: 'omit', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { q: name.trim(), types: ['dancers'], perGroup: 5 } }),
  })
  if (!response.ok) throw new Error('Could not search public dancer profiles.')
  const body = await response.json()
  if (body.error) throw new Error('Could not search public dancer profiles.')
  const groups: Array<{ group_key?: string[] }> = (body.result ?? body.data)?.dancers?.grouped_hits ?? []
  const names = [...new Map(groups.map(g => [normalizeName(g.group_key?.[0] ?? ''), g.group_key?.[0] ?? ''])).entries()].filter(([key]) => key)
  const matches = await Promise.all(names.map(async ([key, display]) => {
    const result = await fetch(`https://scotdance.firebaseio.com/production/dancers:index/${encodeURIComponent(key)}.json`, { credentials: 'omit', signal })
    if (!result.ok) throw new Error('Could not load public dancer profiles.')
    const record = await result.json()
    const id = typeof record === 'string' ? record : record?.id
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(id) ? { id, name: record?.name || display } as PublicDancer : null
  }))
  const exact = normalizeName(name)
  return matches.filter((m): m is PublicDancer => !!m).sort((a, b) => Number(normalizeName(b.name) === exact) - Number(normalizeName(a.name) === exact))
}
