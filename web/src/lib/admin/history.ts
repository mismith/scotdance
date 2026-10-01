import { computed, shallowReactive, type ComputedRef } from 'vue'
import { confirm, toast } from '@/lib/admin/feedback'
import { friendlyError } from '@/lib/admin/write'

// Undo and redo for Manage, one history per competition, for this visit
// (it starts empty after a reload). Every change records the values it
// replaced; undoing writes them back. If someone else has changed the same
// thing since (another admin on another device), undo asks first rather than
// silently putting the old value over theirs.

export interface Change {
  id: number
  label: string
  /** Values before and after, by path (as the writer understands them). */
  before: Record<string, unknown>
  after: Record<string, unknown>
}

export interface HistoryWriter {
  /** Write values by path. Must not record history itself. */
  apply: (updates: Record<string, unknown>) => Promise<void>
  /** The value at a path right now. */
  read: (path: string) => unknown
}

interface Stacks {
  undo: Change[]
  redo: Change[]
  writer: HistoryWriter
}

const LIMIT = 100
let nextId = 1
const histories = shallowReactive(new Map<string, Stacks>())

/** Values Firebase treats as "nothing": stored and read back the same way. */
function normal(v: unknown): unknown {
  if (v === undefined || v === '' || v === null) return null
  if (Array.isArray(v)) return v.map(normal)
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const n = normal(x)
      if (n !== null) out[k] = n
    }
    return Object.keys(out).length ? out : null
  }
  return v
}
// Links the server adds to new dancers and staff (to their profiles across
// competitions). Nobody edited anything, so they don't make a change "changed since".
const SERVER_KEYS = new Set(['dancerId', 'judgeId', 'piperId'])

function same(a: unknown, b: unknown): boolean {
  const x = normal(a)
  const y = normal(b)
  if (x === y) return true
  if (typeof x !== 'object' || typeof y !== 'object' || !x || !y) return false
  const keys = (o: object) => Object.keys(o).filter((k) => !SERVER_KEYS.has(k))
  const kx = keys(x)
  const ky = keys(y)
  return kx.length === ky.length && kx.every((k) => same((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k]))
}

function stacks(scope: string, writer?: HistoryWriter): Stacks | undefined {
  let s = histories.get(scope)
  if (!s && writer) {
    s = { undo: [], redo: [], writer }
    histories.set(scope, s)
  }
  if (s && writer) s.writer = writer
  return s
}

/** Remember a change that was just saved. Returns its id (for a toast's Undo). */
export function record(scope: string, writer: HistoryWriter, label: string, before: Record<string, unknown>, after: Record<string, unknown>): number {
  const s = stacks(scope, writer)!
  const change: Change = { id: nextId++, label, before, after: Object.fromEntries(Object.entries(after).map(([k, v]) => [k, normal(v)])) }
  s.undo = [...s.undo, change].slice(-LIMIT)
  s.redo = []
  histories.set(scope, { ...s })
  return change.id
}

async function step(scope: string, from: 'undo' | 'redo', id?: number): Promise<boolean> {
  const s = stacks(scope)
  if (!s) return false
  const list = s[from]
  const change = id == null ? list[list.length - 1] : list.find((c) => c.id === id)
  if (!change) return false
  const expected = from === 'undo' ? change.after : change.before
  const target = from === 'undo' ? change.before : change.after
  const changedSince = Object.entries(expected).some(([path, v]) => !same(s.writer.read(path), v))
  if (changedSince) {
    const ok = await confirm({
      title: `${from === 'undo' ? 'Undo' : 'Redo'} anyway?`,
      message: `“${change.label}” has been changed again since, maybe by another admin. ${from === 'undo' ? 'Undoing' : 'Redoing'} puts back the earlier version over that.`,
      confirmLabel: from === 'undo' ? 'Undo anyway' : 'Redo anyway',
    })
    if (!ok) return false
  }
  try {
    await s.writer.apply(target)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
    return false
  }
  const to = from === 'undo' ? 'redo' : 'undo'
  const next = { ...s, [from]: s[from].filter((c) => c !== change), [to]: [...s[to], change] }
  histories.set(scope, next)
  toast(`${from === 'undo' ? 'Undone' : 'Redone'}: ${change.label}`)
  return true
}

export const undo = (scope: string, id?: number) => step(scope, 'undo', id)
export const redo = (scope: string) => step(scope, 'redo')

export interface HistoryState {
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  undoLabel: ComputedRef<string | null>
  redoLabel: ComputedRef<string | null>
}

export function historyState(scope: () => string): HistoryState {
  const s = () => histories.get(scope())
  return {
    canUndo: computed(() => !!s()?.undo.length),
    canRedo: computed(() => !!s()?.redo.length),
    undoLabel: computed(() => s()?.undo.at(-1)?.label ?? null),
    redoLabel: computed(() => s()?.redo.at(-1)?.label ?? null),
  }
}
