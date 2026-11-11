// @vitest-environment node
import { stored } from '../../../../functions/src/mcp/changes'
import { DatabaseError, type Query, type Session } from '../../../../functions/src/mcp/session'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>

/** The database in memory, as the REST session sees it: paths, multi-path updates with server time, simple queries */
export function fakeSession(initial: Json = {}, opts: { uid?: string; deny?: (path: string) => boolean } = {}) {
  const tree: Json = JSON.parse(JSON.stringify(initial))
  let clock = 1_000
  const updates: Json[] = []
  const keys = (p: string) => p.split('/').filter(Boolean)
  const getIn = (p: string) => keys(p).reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Json)[k] : undefined), tree)
  const setIn = (p: string, v: unknown) => {
    const ks = keys(p)
    const trail: Json[] = [tree]
    ks.slice(0, -1).forEach((k) => { trail.push((trail[trail.length - 1][k] ??= {}) as Json) })
    const last = trail[trail.length - 1]
    if (v === null || v === undefined) delete last[ks[ks.length - 1]]
    else last[ks[ks.length - 1]] = v
    // The database keeps no empty records
    for (let i = trail.length - 1; i > 0 && !Object.keys(trail[i]).length; i--) delete trail[i - 1][ks[i - 1]]
  }
  const resolve = (v: unknown): unknown => {
    if (v && typeof v === 'object') {
      if ((v as Json)['.sv'] === 'timestamp') return clock
      if (Array.isArray(v)) return v.map(resolve)
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]))
    }
    return v
  }
  const session: Session = {
    uid: opts.uid ?? 'u1',
    connection: 'c1',
    client: 'Claude',
    read: async (path: string, query?: Query) => {
      const v = getIn(path)
      if (query?.orderBy && v && typeof v === 'object') {
        const by = (x: unknown) => (x as Json)?.[String(query.orderBy)] ?? 0
        let entries = Object.entries(v as Json).sort(([, a], [, b]) => (by(a) < by(b) ? -1 : by(a) > by(b) ? 1 : 0))
        if (query.startAt !== undefined) entries = entries.filter(([, x]) => by(x) >= query.startAt!)
        if (query.endAt !== undefined) entries = entries.filter(([, x]) => by(x) <= query.endAt!)
        return Object.fromEntries(query.limitToLast ? entries.slice(-Number(query.limitToLast)) : entries)
      }
      return v === undefined ? null : JSON.parse(JSON.stringify(v))
    },
    write: async (path, value) => { setIn(path, resolve(value)) },
    update: async (values) => {
      clock += 1000
      if (opts.deny && Object.keys(values).some(opts.deny)) throw new DatabaseError('permission-denied', 401)
      updates.push(values)
      for (const [p, v] of Object.entries(values)) setIn(p, v === null ? null : stored(resolve(v)))
    },
    remove: async (path) => { setIn(path, null) },
  }
  return { session, tree, updates, tick: (ms: number) => { clock += ms } }
}

