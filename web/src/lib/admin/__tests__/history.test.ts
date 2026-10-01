import { beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmRequest, toasts } from '@/lib/admin/feedback'

// history.ts only needs friendlyError from write.ts; keep Firebase out of it.
vi.mock('@/lib/admin/write', () => ({ friendlyError: (e: unknown) => `failed: ${e instanceof Error ? e.message : e}` }))

const { historyState, record, redo, undo } = await import('@/lib/admin/history')

// A writer over a plain object, standing in for the database.
function fakeWriter(initial: Record<string, unknown> = {}) {
  const db: Record<string, unknown> = { ...initial }
  const writer = {
    db,
    fail: false,
    writes: [] as Array<Record<string, unknown>>,
    async apply(updates: Record<string, unknown>) {
      if (writer.fail) throw new Error('nope')
      writer.writes.push(updates)
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '' || v === undefined) delete db[k]
        else db[k] = v
      }
    },
    read: (path: string) => db[path],
  }
  return writer
}

/** Make a change the way Manage does: write, then record what it replaced. */
async function change(scope: string, w: ReturnType<typeof fakeWriter>, label: string, updates: Record<string, unknown>) {
  const before = Object.fromEntries(Object.keys(updates).map((k) => [k, w.db[k] ?? null]))
  await w.apply(updates)
  return record(scope, w, label, before, updates)
}

let scope = ''
let n = 0
beforeEach(() => {
  scope = `c${++n}`
  toasts.splice(0)
  confirmRequest.value?.resolve(false)
})

describe('undo and redo', () => {
  it('undoes and redoes the latest change', async () => {
    const w = fakeWriter({ name: 'Ava' })
    const state = historyState(() => scope)
    await change(scope, w, 'First name of Ava', { name: 'Avah' })
    expect([state.canUndo.value, state.canRedo.value, state.undoLabel.value]).toEqual([true, false, 'First name of Ava'])

    expect(await undo(scope)).toBe(true)
    expect(w.db.name).toBe('Ava')
    expect([state.canUndo.value, state.canRedo.value, state.redoLabel.value]).toEqual([false, true, 'First name of Ava'])
    expect(toasts.at(-1)?.message).toBe('Undone: First name of Ava')

    expect(await redo(scope)).toBe(true)
    expect(w.db.name).toBe('Avah')
    expect(toasts.at(-1)?.message).toBe('Redone: First name of Ava')
  })

  it('steps back through several changes in order', async () => {
    const w = fakeWriter()
    await change(scope, w, 'one', { a: 1 })
    await change(scope, w, 'two', { a: 2, b: 'x' })
    await change(scope, w, 'three', { b: 'y' })
    await undo(scope)
    await undo(scope)
    expect(w.db).toEqual({ a: 1 })
    await undo(scope)
    expect(w.db).toEqual({})
    expect(await undo(scope)).toBe(false)
    await redo(scope)
    await redo(scope)
    await redo(scope)
    expect(w.db).toEqual({ a: 2, b: 'y' })
    expect(await redo(scope)).toBe(false)
  })

  it('a new change clears what could be redone', async () => {
    const w = fakeWriter()
    const state = historyState(() => scope)
    await change(scope, w, 'one', { a: 1 })
    await undo(scope)
    expect(state.canRedo.value).toBe(true)
    await change(scope, w, 'two', { a: 2 })
    expect(state.canRedo.value).toBe(false)
    expect(await redo(scope)).toBe(false)
  })

  it('undoes a grouped change (several paths) all together', async () => {
    const w = fakeWriter({ 'groups/g1': { name: '7 Years' }, 'dances/d1/groupIds/g1': true, 'results/g1': { d1: ['x'] } })
    await change(scope, w, 'Deleted 7 Years', { 'groups/g1': null, 'dances/d1/groupIds/g1': null, 'results/g1': null })
    expect(w.db).toEqual({})
    await undo(scope)
    expect(w.db).toEqual({ 'groups/g1': { name: '7 Years' }, 'dances/d1/groupIds/g1': true, 'results/g1': { d1: ['x'] } })
    expect(w.writes.at(-1)).toEqual({ 'groups/g1': { name: '7 Years' }, 'dances/d1/groupIds/g1': true, 'results/g1': { d1: ['x'] } })
  })

  it('undoes a particular change from its toast, leaving later ones', async () => {
    const w = fakeWriter()
    const first = await change(scope, w, 'one', { a: 1 })
    await change(scope, w, 'two', { b: 2 })
    expect(await undo(scope, first)).toBe(true)
    expect(w.db).toEqual({ b: 2 })
    // Its toast can't undo it twice.
    expect(await undo(scope, first)).toBe(false)
    // The next undo is still "two"; redo brings back "one" first.
    await undo(scope)
    expect(w.db).toEqual({})
    await redo(scope)
    expect(w.db).toEqual({ b: 2 })
  })

  it('keeps separate histories per competition', async () => {
    const a = fakeWriter()
    const b = fakeWriter()
    await change(`${scope}-a`, a, 'in a', { x: 1 })
    await change(`${scope}-b`, b, 'in b', { x: 2 })
    await undo(`${scope}-a`)
    expect(a.db).toEqual({})
    expect(b.db).toEqual({ x: 2 })
    expect(historyState(() => `${scope}-b`).undoLabel.value).toBe('in b')
  })

  it('treats empty strings, nulls and missing values as the same', async () => {
    const w = fakeWriter({ 'd/location': 'Calgary' })
    await change(scope, w, 'Location', { 'd/location': '' })
    // Nothing else changed it (it reads back as undefined): no question asked.
    const undone = undo(scope)
    expect(confirmRequest.value).toBeNull()
    expect(await undone).toBe(true)
    expect(w.db['d/location']).toBe('Calgary')
  })

  it('compares objects by value, ignoring empty parts', async () => {
    const w = fakeWriter()
    await change(scope, w, 'Added', { 'dancers/x': { firstName: 'Ava', lastName: '', location: null } })
    // The database keeps only the non-empty fields.
    w.db['dancers/x'] = { firstName: 'Ava' }
    const undone = undo(scope)
    expect(confirmRequest.value).toBeNull()
    expect(await undone).toBe(true)
    expect(w.db['dancers/x']).toBeUndefined()
  })

  it('doesn’t count the profile links the server adds to new dancers and staff', async () => {
    const w = fakeWriter()
    await change(scope, w, 'Added Zoe Test', { 'dancers/x': { firstName: 'Zoe', number: '999' }, 'staff/j': { firstName: 'Iain', type: 'Judge' } })
    // The aggregator links them up a moment later.
    w.db['dancers/x'] = { firstName: 'Zoe', number: '999', dancerId: '-Profile1' }
    w.db['staff/j'] = { firstName: 'Iain', type: 'Judge', judgeId: '-Judge1' }
    const undone = undo(scope)
    expect(confirmRequest.value).toBeNull()
    expect(await undone).toBe(true)
    expect(w.db).toEqual({})
  })

  it('caps the history at 100 changes', async () => {
    const w = fakeWriter()
    for (let i = 0; i < 105; i += 1) await change(scope, w, `c${i}`, { a: i })
    let steps = 0
    while (await undo(scope)) steps += 1
    expect(steps).toBe(100)
    expect(w.db.a).toBe(4)
  })
})

describe('when someone else changed it since', () => {
  it('asks before undoing, and does nothing when declined', async () => {
    const w = fakeWriter({ name: 'Ava' })
    await change(scope, w, 'First name of Ava', { name: 'Avah' })
    w.db.name = 'Ava-Lee' // another admin
    const undone = undo(scope)
    await Promise.resolve()
    expect(confirmRequest.value?.title).toBe('Undo anyway?')
    expect(confirmRequest.value?.message).toContain('“First name of Ava” has been changed again since')
    confirmRequest.value!.resolve(false)
    expect(await undone).toBe(false)
    expect(w.db.name).toBe('Ava-Lee')
    // Still undoable later.
    expect(historyState(() => scope).canUndo.value).toBe(true)
  })

  it('puts the earlier value back when confirmed', async () => {
    const w = fakeWriter({ name: 'Ava' })
    await change(scope, w, 'First name of Ava', { name: 'Avah' })
    w.db.name = 'Ava-Lee'
    const undone = undo(scope)
    await Promise.resolve()
    confirmRequest.value!.resolve(true)
    expect(await undone).toBe(true)
    expect(w.db.name).toBe('Ava')
  })

  it('asks before redoing too', async () => {
    const w = fakeWriter({ name: 'Ava' })
    await change(scope, w, 'First name of Ava', { name: 'Avah' })
    await undo(scope)
    w.db.name = 'Eva'
    const redone = redo(scope)
    await Promise.resolve()
    expect(confirmRequest.value?.title).toBe('Redo anyway?')
    confirmRequest.value!.resolve(true)
    expect(await redone).toBe(true)
    expect(w.db.name).toBe('Avah')
  })

  it('asks when any one path of a grouped change moved on', async () => {
    const w = fakeWriter({ a: 1, b: 1 })
    await change(scope, w, 'both', { a: 2, b: 2 })
    w.db.b = 3
    const undone = undo(scope)
    await Promise.resolve()
    expect(confirmRequest.value).not.toBeNull()
    confirmRequest.value!.resolve(false)
    expect(await undone).toBe(false)
  })
})

describe('when the write fails', () => {
  it('says so and keeps the change undoable', async () => {
    const w = fakeWriter({ name: 'Ava' })
    await change(scope, w, 'First name of Ava', { name: 'Avah' })
    w.fail = true
    expect(await undo(scope)).toBe(false)
    expect(toasts.at(-1)).toMatchObject({ message: 'failed: nope', tone: 'error' })
    expect(historyState(() => scope).canUndo.value).toBe(true)
    w.fail = false
    expect(await undo(scope)).toBe(true)
    expect(w.db.name).toBe('Ava')
  })
})
