// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { deleteCompetitionSheets, getOnGroupSheetsWritten, sheetFiles, type Bucket } from '../../../../functions/src/sheets'

// Judges' sheets' files (functions/src/sheets.ts, ADR 0013): the storage
// rules never let anyone delete, so a page's file goes here when its record
// does, and a deleted competition's whole folder goes with it.

function fakeBucket() {
  const deleted: string[] = []
  const prefixes: string[] = []
  const bucket: Bucket = {
    file: (path) => ({
      delete: async () => {
        deleted.push(path)
      },
    }),
    deleteFiles: async ({ prefix }) => {
      prefixes.push(prefix)
    },
  }
  return { bucket: () => bucket, deleted, prefixes }
}

const at = (dances: Record<string, Record<string, string>>) =>
  Object.fromEntries(Object.entries(dances).map(([d, pages]) => [d, Object.fromEntries(Object.entries(pages).map(([id, path]) => [id, { url: 'https://x', path, width: 1, height: 1 }]))]))
const change = (before: unknown, after: unknown) => ({ before: { val: () => before }, after: { val: () => after } })
const ctx = { params: { competitionId: 'c1', groupId: 'g1' } }
const file = (name: string) => `competitions/sheets/c1/${name}`

describe('sheetFiles', () => {
  it('names every page’s file under an age group', () => {
    expect([...sheetFiles(at({ d1: { a: file('a.webp'), b: file('b.webp') }, d2: { c: file('c.webp') } }), 'c1')]).toEqual([
      file('a.webp'),
      file('b.webp'),
      file('c.webp'),
    ])
  })

  it('never names a file outside the competition’s own folder', () => {
    const value = at({ d1: { a: 'competitions/sheets/c2/a.webp', b: 'competitions/info/logo.png', c: 'competitions/sheets/c1/../c2/x.webp' } })
    expect(sheetFiles(value, 'c1').size).toBe(0)
  })

  it('has nothing for nothing', () => {
    expect(sheetFiles(null, 'c1').size).toBe(0)
    expect(sheetFiles({ d1: 'x', d2: { p: null } }, 'c1').size).toBe(0)
  })
})

describe('when an age group’s sheets change', () => {
  it('deletes the file of a page that was taken off, and only that one', async () => {
    const { bucket, deleted } = fakeBucket()
    const before = at({ d1: { a: file('a.webp'), b: file('b.webp') } })
    const after = at({ d1: { a: file('a.webp') } })
    await getOnGroupSheetsWritten('production', bucket)(change(before, after), ctx)
    expect(deleted).toEqual([`production/${file('b.webp')}`])
  })

  it('deletes every file when the dance or the age group goes', async () => {
    const { bucket, deleted } = fakeBucket()
    await getOnGroupSheetsWritten('development', bucket)(change(at({ d1: { a: file('a.webp') }, d2: { b: file('b.webp') } }), null), ctx)
    expect(deleted.sort()).toEqual([`development/${file('a.webp')}`, `development/${file('b.webp')}`])
  })

  it('deletes nothing when a page is added', async () => {
    const { bucket, deleted } = fakeBucket()
    await getOnGroupSheetsWritten('production', bucket)(change(at({ d1: { a: file('a.webp') } }), at({ d1: { a: file('a.webp'), b: file('b.webp') } })), ctx)
    expect(deleted).toEqual([])
  })

  it('keeps a file another page still uses (a page moved to another dance)', async () => {
    const { bucket, deleted } = fakeBucket()
    await getOnGroupSheetsWritten('production', bucket)(change(at({ d1: { a: file('a.webp') } }), at({ d2: { a: file('a.webp') } })), ctx)
    expect(deleted).toEqual([])
  })
})

describe('when a competition is deleted', () => {
  it('clears its whole folder of sheets', async () => {
    const { bucket, prefixes } = fakeBucket()
    await deleteCompetitionSheets('production', bucket, 'c1')
    expect(prefixes).toEqual(['production/competitions/sheets/c1/'])
  })
})
