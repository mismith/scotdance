import { describe, expect, it } from 'vitest'
import { looksLikeTeamGroup, readSoloRoutine, readTeam, splitMembers, splitName, townsIn } from '@/lib/admin/teamReader'

// Teams typed the ways production has them (ADR 0012), with made-up names.
const read = (first: string | undefined, last?: string, location?: string, group?: string) => readTeam({ first, last, location }, { group })
const names = (r: ReturnType<typeof readTeam>) => r.members.map((m) => `${m.firstName} ${m.lastName}`.trim())

describe('readTeam', () => {
  it('reads title, members and studio', () => {
    const r = read('Silver Sails', 'Isla Grant, Mairi Shaw & Ava Ross', 'Thistle School of Highland Dance')
    expect(r).toMatchObject({ title: 'Silver Sails', studio: 'Thistle School of Highland Dance', location: '', unsure: [] })
    expect(names(r)).toEqual(['Isla Grant', 'Mairi Shaw', 'Ava Ross'])
  })

  it('reads a list that runs across both cells', () => {
    const r = read('Isla Grant &', 'Mairi Shaw', 'MB')
    expect(names(r)).toEqual(['Isla Grant', 'Mairi Shaw'])
    expect(r).toMatchObject({ title: '', location: 'MB' })
    expect(names(read('Isla Grant, Mairi Shaw', 'Ava Ross', 'ON'))).toEqual(['Isla Grant', 'Mairi Shaw', 'Ava Ross'])
  })

  it('reads a duet typed one dancer per cell, where the age group says duets', () => {
    expect(names(read('Isla Grant', 'Mairi Shaw', 'PE', 'Duet Group A'))).toEqual(['Isla Grant', 'Mairi Shaw'])
    expect(names(read('Isla Grant', 'Mairi Shaw,', 'ON', 'Premier Duo/Trios 14 & Under'))).toEqual(['Isla Grant', 'Mairi Shaw'])
  })

  it('never reads a solo’s routine and dancer as a duet elsewhere', () => {
    // OHDA's solos typed routine first: "Home Again" | "Ella Sul" | "House of Bruce".
    const r = read('Home Again', 'Isla Grant', 'House of Bruce', 'Choreography Premier')
    expect(r.members).toEqual([])
    expect(r.unsure.length).toBeGreaterThan(0)
    expect(read('Isla Grant', 'Mairi Shaw', 'PE').members).toEqual([])
  })

  it('splits a title from what follows a dash', () => {
    const r = read('Celtic Storm -', 'Isla Grant & Mairi Shaw', 'Thistle Dancers')
    expect(r).toMatchObject({ title: 'Celtic Storm', studio: 'Thistle Dancers' })
    expect(read('Thistle Dance Academy - Checkmate', undefined, 'SK')).toMatchObject({ title: 'Checkmate', studio: 'Thistle Dance Academy', location: 'SK' })
  })

  it('reads a studio then its routine, and the other way round', () => {
    expect(read('Thistle School of Dance', 'Heather on the Hill', 'SCO')).toMatchObject({ title: 'Heather on the Hill', studio: 'Thistle School of Dance', location: 'SCO' })
    expect(read('Glen Dancers', 'Wonderland', 'NS')).toMatchObject({ title: 'Wonderland', studio: 'Glen Dancers' })
    expect(read('TSHD', 'Stompin')).toMatchObject({ title: 'Stompin', studio: 'TSHD' })
    // No studio word: studio first, as programs print them, and said.
    const r = read('Kilted Kids', 'Whirling Thistles', 'MB', 'Small Group Choreography')
    expect(r).toMatchObject({ title: 'Whirling Thistles', studio: 'Kilted Kids' })
    expect(r.unsure).toContain('Read “Kilted Kids” as the studio')
  })

  it('joins a name cut in two, and says so', () => {
    const r = read('Kids in', 'Kilts', 'MB')
    expect(r.title).toBe('Kids in Kilts')
    expect(r.unsure).toContain('Read as one name: “Kids in Kilts”')
    expect(read('Get Your', 'Ghillies On', 'Regina').title).toBe('Get Your Ghillies On')
    expect(read('Beltane', 'Fire').title).toBe('Beltane Fire')
  })

  it('reads a studio then its routine, without gluing them together', () => {
    expect(read('Gillie Callum', 'Sláinte', 'AB', 'Large Group Choreography')).toMatchObject({ studio: 'Gillie Callum', title: 'Sláinte' })
    expect(read('Kilted Kids', 'Clocks', 'MB', 'Small Group')).toMatchObject({ studio: 'Kilted Kids', title: 'Clocks' })
    expect(read('The College of Piping', 'Mornington', 'PEI')).toMatchObject({ studio: 'The College of Piping', title: 'Mornington', location: 'PEI' })
  })

  it('reads two first names beside a studio as a routine, not dancers', () => {
    const r = read('Thistle School of Highland Dance', 'Tartan and Thistle', 'AB', 'Small Group Choreography')
    expect(r).toMatchObject({ title: 'Tartan and Thistle', studio: 'Thistle School of Highland Dance', members: [] })
    // Alone in the row, they're dancers.
    expect(names(read('Emma & Ava', undefined, undefined, 'Duet'))).toEqual(['Emma', 'Ava'])
  })

  it('prefers full names over a title made of first names', () => {
    const r = read('Ruby & Pearl -', 'Isla Grant & Mairi Shaw', 'TSHD/Jane Grant')
    expect(r).toMatchObject({ title: 'Ruby & Pearl', studio: 'TSHD/Jane Grant' })
    expect(names(r)).toEqual(['Isla Grant', 'Mairi Shaw'])
  })

  it('reads lines in a cell as a list', () => {
    expect(names(read('Ghillies Up', 'Isla Grant, Mairi Shaw\r\nAva Ross, Skye Munro', 'Thistle Dancers'))).toEqual(['Isla Grant', 'Mairi Shaw', 'Ava Ross', 'Skye Munro'])
  })

  it('gives sisters written together their surname', () => {
    const r = read('Great Scot -', 'Emma & Ava Haig', 'Prince George')
    expect(names(r)).toEqual(['Emma Haig', 'Ava Haig'])
    expect(r.unsure).toEqual([])
  })

  it('reads members by initials, and first names only as dancers’ where it knows them', () => {
    const r = read('Snowflakes', 'by E. Grant and C. Shaw')
    expect(names(r)).toEqual(['E. Grant', 'C. Shaw'])
    expect(r.unsure).toEqual([])
    const f = read('Isla, Mairi, Ava, Skye')
    expect(names(f)).toEqual(['Isla', 'Mairi', 'Ava', 'Skye'])
    expect(f.unsure).toContain('First names only')
    const firstNames = new Set(['isla', 'mairi', 'ava'])
    expect(names(readTeam({ first: 'Isla, Mairi, Ava' }, { firstNames }))).toEqual(['Isla', 'Mairi', 'Ava'])
    expect(readTeam({ first: 'Thistle School', last: 'Soldier, Poet, King' }, { firstNames })).toMatchObject({ title: 'Soldier, Poet, King', members: [], unsure: [] })
  })

  it('keeps alternates as dancers, last, and leaves out ages', () => {
    const r = read('Highland Lassies', 'Isla Grant, Mairi Shaw (Alt. Ava Ross)', 'Thistle Dancers')
    expect(names(r)).toEqual(['Isla Grant', 'Mairi Shaw', 'Ava Ross'])
    expect(r.unsure).toEqual([])
    const after = read('Highland Lassies', 'Isla Grant, Mairi Shaw, Ava Ross (alt)')
    expect(names(after)).toEqual(['Isla Grant', 'Mairi Shaw', 'Ava Ross'])
    expect(splitMembers('Isla Grant and Ava Ross (Alternate) & Mairi Shaw')).toEqual({ names: ['Isla Grant', 'Mairi Shaw', 'Ava Ross'], leftOut: [], alternates: 1 })
    // The ways production has them.
    const last = (s: string) => splitMembers(s).names.at(-1)
    expect(last('Isla Grant & Mairi Shaw (Ava Ross alt.)')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw (Alt.Ava Ross)')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw, Ava Ross - alt')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw, alt: Ava Ross')).toBe('Ava Ross')
    expect(last('Isla Grant, Mairi Shaw. Alt, dancer: Ava')).toBe('Ava')
    // Alt is a surname too.
    expect(splitMembers('Isla Alt, Mairi Shaw & Ava Alt')).toEqual({ names: ['Isla Alt', 'Mairi Shaw', 'Ava Alt'], leftOut: [], alternates: 0 })
    // An alternate doesn't make a trio four.
    expect(read('Tartan Trio', 'Isla Grant, Mairi Shaw, Skye Bell (Alt Ava Ross)', '', 'Trio').unsure).toEqual([])
    const a = read('The Good Ones', 'Isla Grant, Mairi Shaw 17, Ava Ross')
    expect(names(a)).toEqual(['Isla Grant', 'Mairi Shaw', 'Ava Ross'])
  })

  it('reads a teacher’s name where the town goes as the studio', () => {
    const places = townsIn(['Red Deer, AB', 'Calgary AB', 'Leduc County AB'])
    const r = readTeam({ first: 'Rain on Me', last: 'Isla Grant, Mairi Shaw', location: 'Laura Sywyk' }, { places })
    expect([r.title, r.studio, r.location]).toEqual(['Rain on Me', 'Laura Sywyk', ''])
    const town = readTeam({ first: 'Rain on Me', last: 'Isla Grant, Mairi Shaw', location: 'Red Deer' }, { places })
    expect([town.studio, town.location]).toEqual(['', 'Red Deer'])
    const routine = readTeam({ first: 'Isla Grant & Mairi Shaw', location: 'Lil’ Elves' }, { places })
    expect([routine.title, routine.studio]).toEqual(['Lil’ Elves', ''])
  })

  it('reads initials and surnames in capitals as dancers, and a studio cut in two as one', () => {
    expect(names(read('Aspects of Dance', 'A. MACDONALD, H. BELLINGHAM & F. TOLLEY'))).toEqual(['A. MACDONALD', 'H. BELLINGHAM', 'F. TOLLEY'])
    expect(read('Tara Olah', 'School').studio).toBe('Tara Olah School')
    expect(read('Logdriver’s Broadsword', 'Isla Grant, Mairi Shaw', 'KRSHD-Erin McConnell, Laura Sywyk').studio).toBe('KRSHD-Erin McConnell, Laura Sywyk')
  })

  it('reads a list carried on in the other cell, and no placeholder as the routine', () => {
    expect(names(read('Isla Grant/Mairi Shaw', 'Ava Ross/Skye Bell'))).toEqual(['Isla Grant', 'Mairi Shaw', 'Ava Ross', 'Skye Bell'])
    expect(names(read('Isla Grant, Mairi Shaw', 'Ava Ross, Skye Bell'))).toEqual(['Isla Grant', 'Mairi Shaw', 'Ava Ross', 'Skye Bell'])
    expect(read('Isla Grant & Mairi Shaw', 'tbc').title).toBe('')
    expect(read('Thistle School', 'By the Quayside').title).toBe('By the Quayside')
  })

  it('settles what one row can’t with what all of production says', () => {
    const people = new Set(['annika bruinsma', 'ruby grant'])
    const firstNames = new Set(['annika', 'ruby', 'isla', 'mairi', 'gillian'])
    const studios = new Map([['kids in kilts', 22], ['highland heathers', 2]])
    const wide = { people, firstNames, studios, places: new Set(['aurora']) }
    expect(names(readTeam({ first: 'Annika', last: 'Bruinsma' }, { ...wide, group: 'Duet Choreography' }))).toEqual(['Annika Bruinsma'])
    expect(readTeam({ first: 'Ripple Effect' }, { ...wide, group: 'Duet Choreography' })).toMatchObject({ title: 'Ripple Effect', members: [], unsure: [] })
    expect(readTeam({ first: 'Green Grow the Rushes -', last: 'Kids in Kilts' }, wide)).toMatchObject({ title: 'Green Grow the Rushes', studio: 'Kids in Kilts', unsure: [] })
    expect(readTeam({ first: 'Kids in Kilts', last: 'Scots Wha Hae' }, wide)).toMatchObject({ title: 'Scots Wha Hae', studio: 'Kids in Kilts', unsure: [] })
    expect(readTeam({ first: 'Kids in Kilts', last: 'Highland Heathers' }, wide)).toMatchObject({ title: 'Highland Heathers', studio: 'Kids in Kilts' })
    expect(readTeam({ first: 'Swing, Swing, Highland Fling •', last: 'Aspects of Dance' }, wide)).toMatchObject({ title: 'Swing, Swing, Highland Fling', studio: 'Aspects of Dance' })
    expect(readTeam({ first: 'Masquerade:', last: 'Isla Grant & Mairi Shaw' }, wide).title).toBe('Masquerade')
    expect(names(readTeam({ first: 'Annika Bruinsma', last: 'RUBY GRANT' }, wide))).toEqual(['Annika Bruinsma', 'RUBY GRANT'])
    expect(readTeam({ first: 'Kids in Kilts -', last: 'Gillian Macdonald' }, wide)).toMatchObject({ title: '', studio: 'Kids in Kilts - Gillian Macdonald' })
    // A routine cut in two, and a teacher beside the routine.
    expect(readTeam({ first: 'Seven', last: 'Wicked Reels' }, wide)).toMatchObject({ title: 'Seven Wicked Reels', studio: '', unsure: [] })
    expect(readTeam({ first: 'Touch', last: 'the Sky' }, wide)).toMatchObject({ title: 'Touch the Sky', unsure: [] })
    expect(readTeam({ first: 'Alive', last: 'Gillian Macdonald' }, wide)).toMatchObject({ title: 'Alive', studio: 'Gillian Macdonald', unsure: [] })
    // A duet whose second cell starts with "&".
    expect(names(readTeam({ first: 'Annika Bruinsma', last: '& Ruby Grant' }, { ...wide, group: 'Duet Choreography' }))).toEqual(['Annika Bruinsma', 'Ruby Grant'])
    // The event's full: the name after the list is the teacher's.
    const duet = readTeam({ first: 'Isla Grant, Mairi Shaw', last: 'Gillian Macdonald', location: 'ON' }, { ...wide, group: 'Pre-Premier Duet Group A' })
    expect([names(duet), duet.studio, duet.unsure]).toEqual([['Isla Grant', 'Mairi Shaw'], 'Gillian Macdonald', []])
    expect(readTeam({ first: 'Isla Grant, Mairi Shaw', last: 'Lorena Harrison', location: 'BC' }, { ...wide, group: 'Duet' })).toMatchObject({ title: '', studio: 'Lorena Harrison' })
    expect(readTeam({ first: 'Isla Grant, Mairi Shaw', last: 'KMSD - Gillian Macdonald' }, wide)).toMatchObject({ title: '', studio: 'KMSD - Gillian Macdonald' })
    // Not a first name: the routine.
    expect(readTeam({ first: 'Isla Grant & Mairi Shaw', last: 'Bagpipe Blues' }, wide)).toMatchObject({ title: 'Bagpipe Blues', unsure: [] })
    // A town where the town goes, else the routine.
    expect(readTeam({ first: 'Isla Grant', last: 'Mairi Shaw', location: 'Aurora' }, { ...wide, group: 'Duet' })).toMatchObject({ title: '', location: 'Aurora' })
    expect(readTeam({ first: 'Isla Grant', last: 'Mairi Shaw', location: 'Twins in Trews' }, { ...wide, group: 'Duet' })).toMatchObject({ title: 'Twins in Trews', unsure: [] })
    // A partner's first name where the town goes is the other dancer.
    expect(names(readTeam({ first: 'Annika', last: 'Bruinsma', location: 'Ruby' }, { ...wide, group: 'Duet' }))).toEqual(['Annika Bruinsma', 'Ruby'])
    // A dancer here typed where the routine goes is one of them.
    const known = readTeam({ first: 'Ruby Grant', last: 'Isla Grant & Mairi Shaw' }, { ...wide, knownNames: new Set(['ruby grant']) })
    expect([names(known), known.title]).toEqual([['Ruby Grant', 'Isla Grant', 'Mairi Shaw'], ''])
    // Titles that are lists, but not of names.
    expect(readTeam({ first: '1, 2, 3, 4 -', last: 'Isla Grant & Mairi Shaw' }, wide).unsure).toEqual([])
  })

  it('keeps a title with an apostrophe whole', () => {
    expect(read("Double 'E'", 'Isla Grant & Mairi Shaw').title).toBe("Double 'E'")
    expect(read('“Silver Sails”').title).toBe('Silver Sails')
  })

  it('reads two names as a duet, but not in an age group for more', () => {
    expect(names(read('Kilted Kids', 'Whirling Thistles', 'MB', 'Duet Choreography'))).toEqual(['Kilted Kids', 'Whirling Thistles'])
  })

  it('flags a title that’s a dancer entered here', () => {
    const r = readTeam({ first: 'Ruby Grant', last: 'Isla Grant & Mairi Shaw' }, { knownNames: new Set(['ruby grant']) })
    expect(r.unsure).toContain('“Ruby Grant” is a dancer here too')
    expect(readTeam({ first: 'Silver Sails', last: 'Isla Grant & Mairi Shaw' }).unsure).toEqual([])
  })

  it('reads a routine typed where the town goes, and says so', () => {
    const r = read('Isla Grant & Mairi Shaw', '', 'Better Place')
    expect(r).toMatchObject({ title: 'Better Place', location: '' })
    expect(r.unsure).toContain('Read “Better Place” as the routine')
    expect(read('Isla Grant & Mairi Shaw', '', 'Calgary, AB').location).toBe('Calgary, AB')
    expect(read('Isla Grant & Mairi Shaw', '', 'Leduc County AB').location).toBe('Leduc County AB')
  })

  it('folds a teacher’s name into their studio', () => {
    expect(read('Susan Bell School of Dance -', 'Susan Bell', 'MB')).toMatchObject({ title: '', studio: 'Susan Bell School of Dance' })
  })

  it('flags more dancers than the event has room for', () => {
    expect(read('Swans', 'Isla Grant, Mairi Shaw & Jane Bell', '', 'Duet Group B').unsure).toContain('3 dancers for a duet')
    expect(read('Swans', 'Isla Grant, Mairi Shaw & Jane Bell', '', 'Premier Duo/Trios').unsure).toEqual([])
  })

  it('flags what could be one dancer, or nothing at all', () => {
    expect(read('Ruby Grant', undefined, 'AB').unsure).toContain('“Ruby Grant” looks like one dancer')
    expect(read('', '', '').unsure).toContain('Nothing to name it by')
  })

  it('reads a studio from Location only when it reads as one', () => {
    expect(read('Reel Time', undefined, 'Thistle School').studio).toBe('Thistle School')
    expect(read('Reel Time', undefined, 'Calgary, AB')).toMatchObject({ studio: '', location: 'Calgary, AB' })
    expect(read('Reel Time', undefined, 'PEI')).toMatchObject({ studio: '', location: 'PEI' })
  })
})

describe('splitMembers', () => {
  it('splits on commas, ampersands, "and", slashes and lines', () => {
    expect(splitMembers('Isla Grant & Mairi Shaw, Ava Ross and Skye Munro / Eilidh Bain\nKirsty Gow').names).toEqual([
      'Isla Grant',
      'Mairi Shaw',
      'Ava Ross',
      'Skye Munro',
      'Eilidh Bain',
      'Kirsty Gow',
    ])
  })
})

describe('splitName', () => {
  it('splits as the dancer import does: first word, then the rest', () => {
    expect(splitName('Isla Jean Grant')).toEqual({ firstName: 'Isla', lastName: 'Jean Grant' })
    expect(splitName('Grant, Isla')).toEqual({ firstName: 'Isla', lastName: 'Grant' })
    expect(splitName('Isla')).toEqual({ firstName: 'Isla', lastName: '' })
  })
})

describe('looksLikeTeamGroup', () => {
  it('knows team events by their names', () => {
    for (const n of ['Choreography Duet', 'Premier Duo/Trio', 'Trio Group B', 'Double Sword Group A', 'Team Broadsword Group B', 'Reel Team Open', 'Small Group Choreography', 'Large Group', 'Pre-Premier Group Choreography', 'Group Choreography 14 Years & Over']) {
      expect(looksLikeTeamGroup(n), n).toBe(true)
    }
  })

  it('leaves solos and ordinary age groups alone', () => {
    for (const n of ['Premier 12 & Under 14', 'Solo Choreography Premier', 'Primary 6 Years Group A', 'Opening Ceremonies Dance Group', 'Solo Group C', 'Choreography 15 & Over']) {
      expect(looksLikeTeamGroup(n), n).toBe(false)
    }
  })
})

describe('readSoloRoutine', () => {
  it('reads a routine typed before a dancer’s name', () => {
    expect(readSoloRoutine({ first: 'Celtic Fairy - ', last: 'Isla Grant', location: 'Thistle Dancers' })).toEqual({
      firstName: 'Isla',
      lastName: 'Grant',
      title: 'Celtic Fairy',
      studio: 'Thistle Dancers',
      location: '',
    })
  })

  it('reads a routine in quotes after a dancer’s name', () => {
    expect(readSoloRoutine({ first: 'Isla Grant', last: '“Shake That Bagpipe”' })).toMatchObject({ firstName: 'Isla', lastName: 'Grant', title: 'Shake That Bagpipe' })
  })

  it('leaves a plain dancer alone', () => {
    expect(readSoloRoutine({ first: 'Isla', last: 'Grant', location: 'Inverness' })).toBeNull()
  })
})
