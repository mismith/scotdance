// A small in-memory Realtime Database for testing the Cloud Functions
// (the aggregators in functions/src/utility/aggregate.ts, and alerts in
// functions/src/notifications.ts): paths, get / set / update / remove / push,
// orderByChild queries, transactions whose first try sees null (as the
// admin SDK's do when nothing is cached), and the trigger events each write
// causes, so a test can run them in order, out of order, or all at once.

type Json = unknown
type Obj = Record<string, Json>

const clone = <T>(v: T): T => (v === undefined || v === null ? (null as T) : JSON.parse(JSON.stringify(v)))
const parts = (path: string) => path.split('/').filter(Boolean)
/** Let other "function instances" run: every database call is a round trip. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** RTDB stores no nulls and no empty objects, and gives lists (like placings) back as arrays. */
function tidy(v: Json): Json {
  if (v === null || v === undefined) return null
  if (typeof v !== 'object') return v
  if (Array.isArray(v)) {
    const list = v.map(tidy)
    return list.some((x) => x !== null) ? list : null
  }
  const out: Obj = {}
  for (const [k, x] of Object.entries(v as Obj)) {
    const t = tidy(x)
    if (t !== null) out[k] = t
  }
  return Object.keys(out).length ? out : null
}

function setIn(node: Json, keys: string[], value: Json): Json {
  if (!keys.length) return value
  const obj: Obj = node && typeof node === 'object' ? { ...(node as Obj) } : {}
  obj[keys[0]] = setIn(obj[keys[0]] ?? null, keys.slice(1), value)
  return obj
}

function getIn(node: Json, keys: string[]): Json {
  let n = node
  for (const k of keys) {
    if (!n || typeof n !== 'object') return null
    n = (n as Obj)[k] ?? null
  }
  return n
}

export interface Snap {
  val(): Json
  exists(): boolean
  numChildren(): number
}
export const snap = (v: Json): Snap => ({
  val: () => clone(v),
  exists: () => v !== null,
  numChildren: () => (v && typeof v === 'object' ? Object.keys(v).length : 0),
})

export interface TriggerEvent {
  pattern: string
  path: string
  params: Record<string, string>
  before: Json
  after: Json
}

/** Concrete paths in `tree` matching a pattern like `competitions:data/{competitionId}/dancers/{dancerId}`. */
function matchesOf(tree: Json, pattern: string[], at: string[] = [], params: Record<string, string> = {}): Array<{ path: string; params: Record<string, string> }> {
  if (!pattern.length) return [{ path: at.join('/'), params }]
  const [head, ...rest] = pattern
  const node = getIn(tree, at)
  if (!node || typeof node !== 'object') return []
  const wild = /^\{(.+)\}$/.exec(head)
  if (!wild) return head in (node as Obj) ? matchesOf(tree, rest, [...at, head], params) : []
  return Object.keys(node as Obj).flatMap((k) => matchesOf(tree, rest, [...at, k], { ...params, [wild[1]]: k }))
}

/** RTDB's orderByChild order: missing, false, true, numbers, strings, then objects. */
function compareOrder(a: Json, b: Json): number {
  const rank = (v: Json) => (v === null || v === undefined ? 0 : v === false ? 1 : v === true ? 2 : typeof v === 'number' ? 3 : typeof v === 'string' ? 4 : 5)
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if ((ra !== 3 && ra !== 4) || a === b) return 0
  return (a as number | string) < (b as number | string) ? -1 : 1
}

/** `ref.orderByChild(key)` with `startAt`, `endAt` and `equalTo`. */
export class FakeQuery {
  constructor(
    private readonly db: FakeRtdb,
    readonly path: string,
    private readonly key: string,
    private readonly bounds: { start?: Json; end?: Json } = {},
  ) {}

  startAt(value: Json) {
    return new FakeQuery(this.db, this.path, this.key, { ...this.bounds, start: value })
  }

  endAt(value: Json) {
    return new FakeQuery(this.db, this.path, this.key, { ...this.bounds, end: value })
  }

  equalTo(value: Json) {
    return new FakeQuery(this.db, this.path, this.key, { start: value, end: value })
  }

  async get() {
    await tick()
    const node = this.db.read(this.path)
    if (!node || typeof node !== 'object') return snap(null)
    const { bounds } = this
    const hits = Object.entries(node as Obj).filter(([, child]) => {
      const v = getIn(child, parts(this.key))
      return (!('start' in bounds) || compareOrder(v, bounds.start) >= 0) && (!('end' in bounds) || compareOrder(v, bounds.end) <= 0)
    })
    return snap(hits.length ? Object.fromEntries(hits) : null)
  }
}

const related = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`) || b === ''

export class FakeRtdb {
  data: Json = null
  /** Trigger paths, e.g. `competitions:data/{competitionId}/dancers/{dancerId}`. */
  patterns: string[] = []
  events: TriggerEvent[] = []
  writes = 0
  /** Paths of every plain (non-transaction) write, in order. */
  plainWrites: string[][] = []
  /** Called while a transaction waits on the server: a test can write meanwhile. */
  duringTransaction: ((path: string) => void) | null = null
  private pushes = 0

  ref(path = '') {
    return new FakeRef(this, path)
  }

  read(path: string): Json {
    return clone(getIn(this.data, parts(path)))
  }

  /** A push id: later ones sort after earlier ones, like the real thing. */
  pushId() {
    this.pushes += 1
    return `-P${String(this.pushes).padStart(8, '0')}`
  }

  /** Apply `{ path: value }` writes together, and queue the trigger events they cause. */
  write(updates: Record<string, Json>) {
    const before = this.data
    let next = this.data
    for (const [path, value] of Object.entries(updates)) next = setIn(next, parts(path), clone(value))
    this.data = tidy(next)
    this.writes += 1
    const written = Object.keys(updates).map((p) => parts(p).join('/'))
    for (const pattern of this.patterns) {
      const seen = new Map<string, Record<string, string>>()
      for (const tree of [before, this.data]) {
        for (const m of matchesOf(tree, parts(pattern))) seen.set(m.path, m.params)
      }
      for (const [path, params] of seen) {
        if (!written.some((w) => related(path, w))) continue
        const b = getIn(before, parts(path))
        const a = getIn(this.data, parts(path))
        if (JSON.stringify(b) !== JSON.stringify(a)) this.events.push({ pattern, path, params, before: clone(b), after: clone(a) })
      }
    }
  }
}

export class FakeRef {
  constructor(
    private readonly db: FakeRtdb,
    readonly path: string,
  ) {}

  get key() {
    return parts(this.path).at(-1) ?? null
  }

  child(path: string) {
    return new FakeRef(this.db, [...parts(this.path), ...parts(path)].join('/'))
  }

  /** A new child; given a value, it's written too (awaiting it waits for that, as the SDK's ThenableReference does). */
  push(value?: Json) {
    const ref = this.child(this.db.pushId())
    if (value === undefined) return ref
    const written = ref.set(value).then(() => new FakeRef(this.db, ref.path))
    return Object.assign(new FakeRef(this.db, ref.path), { then: written.then.bind(written) })
  }

  /** A snapshot of what's here, knowing where it's from (`ref`, `key`), as the SDK's do. */
  private snapshot(v: Json) {
    return { ...snap(v), ref: this as FakeRef, key: this.key }
  }

  orderByChild(key: string) {
    return new FakeQuery(this.db, this.path, key)
  }

  async get() {
    await tick()
    return this.snapshot(this.db.read(this.path))
  }

  async once(event: 'value') {
    void event
    return this.get()
  }

  async set(value: Json) {
    await tick()
    this.db.plainWrites.push([this.path])
    this.db.write({ [this.path]: value })
  }

  async update(values: Obj) {
    await tick()
    const updates = Object.fromEntries(Object.entries(values).map(([k, v]) => [[...parts(this.path), ...parts(k)].join('/'), v]))
    this.db.plainWrites.push(Object.keys(updates))
    this.db.write(updates)
  }

  async remove() {
    await this.set(null)
  }

  async transaction(update: (current: Json) => Json) {
    const started = this.db.plainWrites.length
    // Nothing is cached, so the first try sees null…
    let next = update(null)
    if (next === undefined) return { committed: false, snapshot: this.snapshot(null) }
    this.db.duringTransaction?.(this.path)
    await tick()
    // The SDK cancels a pending transaction when this process sets or updates
    // the same place meanwhile.
    if (this.db.plainWrites.slice(started).some((paths) => paths.some((p) => related(parts(p).join('/'), this.path)))) {
      throw new Error('set')
    }
    const current = this.db.read(this.path)
    // …and when that guess was wrong the server sends the real value to try again.
    if (current !== null) {
      next = update(clone(current))
      if (next === undefined) return { committed: false, snapshot: this.snapshot(current) }
    }
    this.db.write({ [this.path]: next })
    return { committed: true, snapshot: this.snapshot(this.db.read(this.path)) }
  }
}
