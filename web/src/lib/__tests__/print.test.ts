import { describe, expect, it } from 'vitest'
import { printSource, type PrintSource } from '@/lib/print/source'
import { ageGroupUnits, coverSheet, drawUnits, firstSessions, groupOrder, programUnits, scheduleUnits, timeAndNote } from '@/lib/print/program'
import { platformUnits } from '@/lib/print/day'
import { placesFor } from '@/lib/print/places'
import { measured, paginate } from '@/lib/print/paginate'
import { printChecks } from '@/lib/print/checks'
import { documentDocx } from '@/lib/print/docx'
import JSZip from 'jszip'
import type { Unit, UnitOf } from '@/lib/print/model'

// Manage › Print lays out what's in Manage the way organisers' own programs
// do (Edmonton 2018, Calgary 2019, the SDCCS): each session's platform grid
// with a judge per cell, then its age groups (a championship's draw before
// it), platform sheets; and the same as a
// Word file. The builders are pure; these pin what each puts on paper.

// A small competition, raw as stored: two platforms, judges rotating, a gap
// left on one platform, an awards line, a sponsor by staff id.
function source(extra: Record<string, unknown> = {}): PrintSource {
  return printSource(
    'c1',
    { name: 'June Classic', date: Date.UTC(2019, 5, 1, 12), venue: 'SAIT Gym', address: '1301 16 Ave NW', location: 'Calgary, AB', sobhd: 'C-AB-CO-19-1014' },
    {
      categories: { cp: { name: 'Primary', _order: 0 }, cb: { name: 'Beginner', _order: 1 } },
      groups: {
        gp: { name: '4 & 5', categoryId: 'cp', _order: 0 },
        g7: { name: '7', categoryId: 'cb', _order: 1, trophy: 'Lunan Trophy', sponsor: 'sp' },
        g8: { name: '8 & 9', categoryId: 'cb', _order: 2, trophy: 'Challenge Cup', sponsor: 'Scottish Imports' },
        gx: { name: '10', categoryId: 'cb', _order: 3 },
      },
      dances: {
        fl: { name: 'Highland Fling', steps: '4', groupIds: { gp: true, g7: true, g8: true }, _order: 0 },
        sw: { name: 'Sword', steps: '2&1', groupIds: { g7: true, g8: true }, _order: 1 },
      },
      dancers: {
        a: { number: '103', firstName: 'Ava', lastName: 'Stone', location: 'Manning', groupId: 'g7' },
        b: { number: '101', firstName: 'Ella', lastName: 'Budman', location: 'Edmonton', groupId: 'g7' },
        c: { number: '102', firstName: 'Isla', lastName: 'Heard', groupId: 'g8' },
        d: { number: '104', firstName: 'Kate', lastName: 'Hunt', groupId: 'gp' },
      },
      staff: {
        j1: { type: 'Judge', firstName: 'Diane', lastName: 'Krugh', location: 'Texas', _order: 0 },
        j2: { type: 'Judge', firstName: 'Kathy', lastName: 'Hopper', location: 'Manitoba', _order: 1 },
        p1: { type: 'Piper', firstName: 'Glenn', lastName: 'Eberth', _order: 2 },
        sp: { type: 'Sponsor', firstName: 'Prowse', lastName: '& Chowne', _order: 3 },
      },
      platforms: { pa: { name: 'A', _order: 0 }, pb: { name: 'B', _order: 1 }, pc: { name: 'C', _order: 2 } },
      schedule: {
        days: {
          d1: {
            order: 0,
            blocks: {
              b1: {
                order: 0,
                name: 'Morning',
                description: '8:45 am\nRegistration at 8:00',
                events: {
                  e1: {
                    order: 0,
                    name: 'Pre-Premier',
                    dances: {
                      x1: { order: 0, danceId: 'fl', platforms: { pa: { orderedGroupIds: ['g7', '1573695643807', 'gp'], orderedJudgeIds: ['j1'] }, pb: { orderedGroupIds: ['g8'], orderedJudgeIds: ['j2'] } } },
                      x2: { order: 1, danceId: 'sw', platforms: { pa: { orderedGroupIds: ['g7'], orderedJudgeIds: ['j2'] }, pb: { orderedGroupIds: ['g8'] } } },
                      x3: { order: 2, name: 'Primary awards' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      draws: { g7: { fl: ['103', '101'], sw: ['101', '103'] } },
      results: {
        g7: { fl: ['b', 'a:tie'], sw: ['a', 'b'], overall: ['a'], callbacks: ['a', 'b'] },
        g8: { fl: false, sw: ['c'] },
      },
      ...extra,
    },
  )
}

const kinds = (units: Unit[]) => units.map((u) => u.kind)

describe('the platform grid', () => {
  const units = scheduleUnits(source())
  const head = units.find((u) => u.kind === 'gridHead') as UnitOf<'gridHead'>
  const rows = units.filter((u): u is UnitOf<'gridRow'> => u.kind === 'gridRow')

  it('starts each session on a new page, headed with its time and note', () => {
    expect(units[0]).toMatchObject({ kind: 'heading', title: 'Morning', aside: '8:45 am', note: 'Registration at 8:00', breakBefore: true, keepWithNext: true })
  })

  it('has a column for each platform the event uses, and no others', () => {
    expect(head.head).toEqual({ title: 'Pre-Premier', time: undefined, platforms: ['Platform A', 'Platform B'] })
  })

  it('names each cell’s judge (they rotate) and its age groups in order, keeping gaps; no entry counts', () => {
    const fling = rows[0].row
    expect(fling).toMatchObject({ kind: 'dance', name: 'Highland Fling (4)' })
    if (fling.kind !== 'dance') throw new Error()
    expect(fling.cells[0]).toEqual({ judges: 'D. Krugh', lines: [{ group: 'Beginner 7' }, null, { group: 'Primary 4 & 5' }] })
    expect(fling.cells[1]).toEqual({ judges: 'K. Hopper', lines: [{ group: 'Beginner 8 & 9' }] })
    const sword = rows[1].row
    if (sword.kind !== 'dance') throw new Error()
    expect(sword.cells.map((c) => c?.judges)).toEqual(['K. Hopper', ''])
  })

  it('runs a line with no dance across every platform', () => {
    expect(rows[2].row).toEqual({ kind: 'note', text: 'Primary awards' })
  })

  it('repeats the event’s header when its rows carry onto a new page', () => {
    expect(rows.every((r) => r.repeat?.kind === 'gridHead' && (r.repeat as UnitOf<'gridHead'>).continued)).toBe(true)
  })

  it('reads a time only when the description leads with one', () => {
    expect(timeAndNote('<p>9:30 am</p><p>Primary first</p>')).toEqual({ time: '9:30 am', note: 'Primary first' })
    expect(timeAndNote('Dancing starts after lunch')).toEqual({ note: 'Dancing starts after lunch' })
    expect(timeAndNote(undefined)).toEqual({})
  })
})

describe('age group blocks', () => {
  const units = ageGroupUnits(source(), 'six').filter((u): u is UnitOf<'ageGroup'> => u.kind === 'ageGroup')

  it('lists each age group with dancers, in the organiser’s order, dancers by number where each dance has its own draw', () => {
    expect(units.map((u) => u.group.title)).toEqual(['Primary 4 & 5', 'Beginner 7', 'Beginner 8 & 9'])
    expect(units[1].group.dancers).toEqual([
      { number: 101, name: 'Ella Budman', location: 'Edmonton' },
      { number: 103, name: 'Ava Stone', location: 'Manning' },
    ])
  })

  it('lists a dancer once, where an older competition holds them once per dance', () => {
    const raw = rawOf()
    const twice = { ...raw.dancers, a2: { ...raw.dancers.a }, a3: { ...raw.dancers.a } }
    const [, g7] = ageGroupUnits(printSource('c1', null, { ...raw, dancers: twice }), 'six') as Array<UnitOf<'ageGroup'>>
    expect(g7.group.dancers.map((d) => d.number)).toEqual([101, 103])
  })

  it('gives each age group a page of its own, and its draw one before it', () => {
    const units = ageGroupUnits(source(), 'six')
    expect(units.every((u) => u.breakBefore)).toBe(true)
  })

  it('has a row per dance and an overall line, except for Primary', () => {
    expect(units[1].group).toMatchObject({ dances: ['Highland Fling (4)', 'Sword (2&1)'], overall: true, places: 2 })
    expect(units[0].group.overall).toBe(false)
  })

  it('names a trophy’s sponsor, by staff record or as typed', () => {
    expect(units[1].group).toMatchObject({ trophy: 'Lunan Trophy', sponsor: 'Prowse & Chowne' })
    expect(units[2].group).toMatchObject({ trophy: 'Challenge Cup', sponsor: 'Scottish Imports' })
  })
})

describe('places on a blank grid', () => {
  it('is six by default, never more than there are dancers', () => {
    expect([1, 5, 6, 30].map((n) => placesFor(n))).toEqual([1, 5, 6, 6])
  })
  it('can be half the dancers up to six (as Edmonton awards medals), or up to ten', () => {
    expect([1, 7, 8, 20].map((n) => placesFor(n, 'half'))).toEqual([1, 4, 4, 6])
    expect([8, 38].map((n) => placesFor(n, 'ten'))).toEqual([8, 10])
  })
})

describe('draws', () => {
  it('lists the dancers in the order they dance where every dance has the same draw, anyone it missed after', () => {
    const raw = rawOf()
    const s = printSource('c1', null, {
      ...raw,
      dancers: { ...raw.dancers, late: { number: '100', firstName: 'Late', lastName: 'Entry', groupId: 'g7' } },
      draws: { g7: { fl: ['103', '101'], sw: ['103', '101'] } },
    })
    const units = ageGroupUnits(s, 'six')
    expect(units.some((u) => u.kind === 'draw')).toBe(false)
    expect((units[1] as UnitOf<'ageGroup'>).group.dancers.map((d) => d.number)).toEqual([103, 101, 100])
  })

  it('prints a draw that differs dance by dance (a championship’s) as its Draw, just before the age group', () => {
    const units = ageGroupUnits(source(), 'six')
    expect(kinds(units)).toEqual(['ageGroup', 'draw', 'ageGroup', 'ageGroup'])
    expect((units[1] as UnitOf<'draw'>).draw).toEqual({ group: 'Beginner 7', dances: ['Highland Fling (4)', 'Sword (2&1)'], rows: [['103', '101'], ['101', '103']], from: 0 })
    expect((units[2] as UnitOf<'ageGroup'>).group.title).toBe('Beginner 7')
    expect(drawUnits(source(), source().groups[0])).toEqual([])
  })

  it('counts a draw for only some dances as differing', () => {
    const s = printSource('c1', null, { ...rawOf(), draws: { g7: { fl: ['103', '101'] } } })
    expect(groupOrder(s, s.groups[1])).toEqual({ draw: [{ dance: 'Highland Fling (4)', list: ['103', '101'] }] })
  })
})

describe('the program', () => {
  // Two sessions: Beginner 7 and Primary dance in the morning, Beginner 8 & 9
  // only in the afternoon.
  function twoSessions() {
    const raw = rawOf()
    const morning = raw.schedule.days.d1.blocks.b1
    const afternoon = { order: 1, name: 'Afternoon', events: { e2: { dances: { y1: { order: 0, danceId: 'sw', platforms: { pa: { orderedGroupIds: ['g8', 'g7'], orderedJudgeIds: ['j1'] } } } } } } }
    morning.events.e1.dances.x2.platforms.pb.orderedGroupIds = []
    const s = printSource('c1', { name: 'June Classic' }, {
      ...raw,
      dancers: { ...raw.dancers, x: { number: '110', firstName: 'Not', lastName: 'Scheduled', groupId: 'gx' } },
      schedule: { days: { d1: { blocks: { b1: { ...morning, order: 0 }, b2: afternoon } } } },
    })
    return s
  }
  const opts = { places: 'six' as const }
  const outline = (units: Unit[]) => units.map((u) => (u.kind === 'heading' ? u.title : u.kind === 'ageGroup' ? u.group.title : u.kind === 'cover' ? 'cover' : null)).filter(Boolean)

  it('follows each session’s schedule with the age groups that start dancing in it, in the organiser’s order', () => {
    const s = twoSessions()
    expect([...firstSessions(s).entries()]).toEqual([['g7', 'd1/b1'], ['gp', 'd1/b1'], ['g8', 'd1/b2']])
    expect(outline(programUnits(s, ['cover', 'schedule', 'groups'], opts))).toEqual(['cover', 'Morning', 'Primary 4 & 5', 'Beginner 7', 'Afternoon', 'Beginner 8 & 9', 'Beginner 10'])
  })

  it('leaves out what’s switched off', () => {
    const s = twoSessions()
    expect(outline(programUnits(s, ['groups'], opts))).toEqual(['Primary 4 & 5', 'Beginner 7', 'Beginner 8 & 9', 'Beginner 10'])
    expect(outline(programUnits(s, ['schedule'], opts))).toEqual(['Morning', 'Afternoon'])
  })

  it('heads its cover with the dates, venue, registration, sessions, judges and pipers', () => {
    expect(coverSheet(source())).toMatchObject({
      name: 'June Classic',
      venue: 'SAIT Gym',
      address: '1301 16 Ave NW, Calgary, AB',
      registrations: ['Registered with ScotDance Canada: C-AB-CO-19-1014'],
      sessions: [{ label: 'Morning', time: '8:45 am' }],
      judges: [{ name: 'Diane Krugh', from: 'Texas' }, { name: 'Kathy Hopper', from: 'Manitoba' }],
      pipers: [{ name: 'Glenn Eberth' }],
    })
  })

  it('dates its cover across the schedule’s days, however they’re stored', () => {
    const raw = rawOf()
    const days = { d1: { order: 0, date: '2018-06-30', blocks: raw.schedule.days.d1.blocks }, d2: { order: 1, date: '2018-07-04', blocks: {} } }
    const s = printSource('c1', { name: 'SDCCS', date: '2018-06-30' }, { ...raw, schedule: { days } })
    expect(coverSheet(s).dates).toMatch(/2018 to .*2018$/)
    expect(coverSheet(printSource('c1', { name: 'One day', date: '2018-06-30' }, raw)).dates).not.toContain(' to ')
  })

})

describe('on the day', () => {
  it('gives each platform a page per session: dances, judge, and numbers in dancing order', () => {
    const units = platformUnits(source())
    expect(kinds(units)).toEqual(['heading', 'platformDance', 'platformDance', 'heading', 'platformDance', 'platformDance'])
    const [a1, a2] = units.filter((u): u is UnitOf<'platformDance'> => u.kind === 'platformDance')
    expect(a1.dance).toEqual({
      dance: 'Highland Fling (4)',
      judges: 'D. Krugh',
      rows: [
        { group: 'Beginner 7', count: 2, order: ['103', '101'], drawn: true, late: [] },
        { group: 'Primary 4 & 5', count: 1, order: ['104'], drawn: false, late: [] },
      ],
    })
    expect(a2.dance.rows[0].order).toEqual(['101', '103'])
  })

  it('lists anyone the draw doesn’t have (a late entry) after it, so nobody drops off', () => {
    const raw = rawOf()
    const s = printSource('c1', null, {
      ...raw,
      dancers: { ...raw.dancers, late: { number: '105', firstName: 'Late', lastName: 'Entry', groupId: 'g7' } },
      // As the old admin left some draws: sparse, so stored as an object.
      draws: { g7: { fl: { 0: '103', 3: '101' } } },
    })
    const fling = platformUnits(s).find((u): u is UnitOf<'platformDance'> => u.kind === 'platformDance')!
    expect(fling.dance.rows[0]).toMatchObject({ order: ['103', '101'], drawn: true, late: ['105'] })
    expect(printChecks(s, 'day').find((c) => c.id === 'odd-draw')?.text).toBe('The draw for Beginner 7 doesn’t match its dancers')
  })
})

describe('pagination', () => {
  const u = (key: string, extra: Partial<Unit> = {}): Unit => ({ key, part: 'groups', kind: 'heading', level: 2, title: key, ...extra }) as Unit
  const heights = (h: Record<string, number>) => new Map(Object.entries(h))
  const room = (upright: number, sideways = upright) => ({ upright, sideways })

  it('fills a page, then starts the next', () => {
    const { pages } = paginate([u('a'), u('b'), u('c')], heights({ a: 40, b: 40, c: 40 }), room(100))
    expect(pages.map((p) => p.map((x) => x.key))).toEqual([['a', 'b'], ['c']])
  })

  it('starts a page where asked, and gives a full-page unit a page of its own', () => {
    const { pages } = paginate([u('a'), u('b', { breakBefore: true }), u('c', { fullPage: true }), u('d')], heights({ a: 10, b: 10, c: 10, d: 10 }), room(100))
    expect(pages.map((p) => p.map((x) => x.key))).toEqual([['a'], ['b'], ['c'], ['d']])
  })

  it('never leaves a heading alone at the foot of a page', () => {
    const { pages } = paginate([u('a'), u('h', { keepWithNext: true }), u('b')], heights({ a: 60, h: 20, b: 30 }), room(100))
    expect(pages.map((p) => p.map((x) => x.key))).toEqual([['a'], ['h', 'b']])
  })

  it('repeats a table’s header on the page its rows carry onto', () => {
    const head = u('head:cont')
    const rows = ['r1', 'r2', 'r3'].map((k) => u(k, { repeat: head }))
    const { pages } = paginate([u('head', { keepWithNext: true }), ...rows], heights({ head: 20, 'head:cont': 20, r1: 40, r2: 40, r3: 40 }), room(100))
    expect(pages.map((p) => p.map((x) => x.key))).toEqual([['head', 'r1', 'r2'], ['head:cont', 'r3']])
    expect(measured([u('head'), ...rows]).map((x) => x.key)).toEqual(['head', 'r1', 'head:cont', 'r2', 'r3'])
  })

  it('keeps a heading with what it heads even when that is too long for a page, and reports it', () => {
    const { pages, overflow } = paginate([u('a'), u('h', { keepWithNext: true }), u('big')], heights({ a: 30, h: 20, big: 150 }), room(100))
    expect(pages.map((p) => p.map((x) => x.key))).toEqual([['a'], ['h', 'big']])
    expect(overflow.map((x) => x.key)).toEqual(['big'])
  })

  it('reports a carried-over row that no longer fits under its repeated header', () => {
    const head = u('head:cont')
    const rows = ['r1', 'r2'].map((k) => u(k, { repeat: head }))
    const { overflow } = paginate(rows, heights({ 'head:cont': 30, r1: 60, r2: 90 }), room(100))
    expect(overflow.map((x) => x.key)).toEqual(['r2'])
  })

  it('reports a full-page unit (a cover, a front panel) too tall for its page', () => {
    const { overflow } = paginate([u('c', { fullPage: true })], heights({ c: 120 }), room(100))
    expect(overflow.map((x) => x.key)).toEqual(['c'])
  })

  it('reports a unit too tall for any page', () => {
    const { pages, overflow } = paginate([u('a'), u('big')], heights({ a: 10, big: 500 }), room(100))
    expect(pages.length).toBe(2)
    expect(overflow.map((x) => x.key)).toEqual(['big'])
  })
})

describe('before you print', () => {
  it('flags dancers left out, missing or shared numbers, groups without dances or not scheduled, and platforms with no judge', () => {
    const raw = rawOf()
    const s = printSource('c1', null, {
      ...raw,
      dancers: {
        ...raw.dancers,
        e: { number: '101', firstName: 'Dup', lastName: 'Licate', groupId: 'gx' },
        f: { firstName: 'No', lastName: 'Number', groupId: 'g8' },
        g: { number: '120', firstName: 'No', lastName: 'Group' },
      },
    })
    const checks = printChecks(s, 'program')
    expect(checks.map((c) => c.id)).toEqual(['no-group', 'no-number', 'dup-number', 'no-dances', 'unscheduled', 'no-judge'])
    expect(checks.find((c) => c.id === 'dup-number')?.text).toBe('Number 101 is on two different dancers')
    expect(checks.find((c) => c.id === 'unscheduled')?.text).toBe('Beginner 10 isn’t on the schedule')
    expect(checks.find((c) => c.id === 'no-judge')?.text).toBe('No judge for Sword on Platform B (Morning)')
  })
})

describe('before you print, draws', () => {
  it('flags a draw that lists a number twice, or one not in the age group', () => {
    const raw = rawOf()
    const ok = printSource('c1', null, { ...raw, draws: { g7: { fl: ['103', '101'] } } })
    expect(printChecks(ok, 'program').some((c) => c.id === 'odd-draw')).toBe(false)
    // Twice, not in the age group, someone missing; and "0103" reads as 103.
    for (const list of [['103', '103', '101'], ['103', '101', '104'], ['103']]) {
      const s = printSource('c1', null, { ...raw, draws: { g7: { fl: list } } })
      expect(printChecks(s, 'program').find((c) => c.id === 'odd-draw')).toMatchObject({ text: 'The draw for Beginner 7 doesn’t match its dancers', route: 'manage.groups.draws', itemId: 'g7' })
    }
    expect(printChecks(printSource('c1', null, { ...raw, draws: { g7: { fl: ['0103', '101'] } } }), 'program').some((c) => c.id === 'odd-draw')).toBe(false)
  })
})

describe('the Word file', () => {
  async function xml(blob: Blob) {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    return zip.file('word/document.xml')!.async('string')
  }
  const opts = { paper: 'letter' as const, title: 'June Classic' }

  it('writes the program with Word’s own heading styles and the theme’s fonts, a line to write the winner on, and page numbers', async () => {
    const units = programUnits(source(), ['cover', 'schedule', 'groups'], { places: 'six' })
    const blob = await documentDocx(units, { ...opts, doc: 'program', numbered: true })
    const doc = await xml(blob)
    expect(doc).toContain('<w:pStyle w:val="Title"/>')
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>')
    expect(doc).toContain('>Morning<')
    expect(doc).toContain('>Platform A<')
    expect(doc).toContain('>Overall winner<')
    expect(doc).toContain('>Draw<')
    expect(doc).toContain('<w:vAlign w:val="center"/>')
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const styles = await zip.file('word/styles.xml')!.async('string')
    expect(styles).toMatch(/w:asciiTheme="minorHAnsi"/)
    const footer = Object.keys(zip.files).find((f) => /^word\/footer\d+\.xml$/.test(f))!
    expect(await zip.file(footer)!.async('string')).toContain('PAGE')
  })

  it('leaves page numbers off when they’re switched off', async () => {
    const doc = await xml(await documentDocx(programUnits(source(), ['groups'], { places: 'six' }), { ...opts, doc: 'program', numbered: false }))
    expect(doc).not.toContain('footerReference')
  })

})

// The raw sections behind source(), to vary.
function rawOf() {
  return {
    categories: { cp: { name: 'Primary', _order: 0 }, cb: { name: 'Beginner', _order: 1 } },
    groups: {
      gp: { name: '4 & 5', categoryId: 'cp', _order: 0 },
      g7: { name: '7', categoryId: 'cb', _order: 1 },
      g8: { name: '8 & 9', categoryId: 'cb', _order: 2 },
      gx: { name: '10', categoryId: 'cb', _order: 3 },
    },
    dances: {
      fl: { name: 'Highland Fling', steps: '4', groupIds: { gp: true, g7: true, g8: true }, _order: 0 },
      sw: { name: 'Sword', steps: '2&1', groupIds: { g7: true, g8: true }, _order: 1 },
    },
    dancers: {
      a: { number: '103', firstName: 'Ava', lastName: 'Stone', groupId: 'g7' },
      b: { number: '101', firstName: 'Ella', lastName: 'Budman', groupId: 'g7' },
      c: { number: '102', firstName: 'Isla', lastName: 'Heard', groupId: 'g8' },
      d: { number: '104', firstName: 'Kate', lastName: 'Hunt', groupId: 'gp' },
    } as Record<string, Record<string, string>>,
    platforms: { pa: { name: 'A', _order: 0 }, pb: { name: 'B', _order: 1 } },
    staff: { j1: { type: 'Judge', firstName: 'Diane', lastName: 'Krugh' } },
    schedule: {
      days: {
        d1: {
          blocks: {
            b1: {
              name: 'Morning',
              events: {
                e1: {
                  dances: {
                    x1: { order: 0, danceId: 'fl', platforms: { pa: { orderedGroupIds: ['g7', 'gp'], orderedJudgeIds: ['j1'] } } },
                    x2: { order: 1, danceId: 'sw', platforms: { pb: { orderedGroupIds: ['g8'] } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}
