// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  countryOf,
  icsDays,
  organisationFor,
  readIcs,
  readPlace,
  readRsobhd,
  readScotDanceUsa,
  readSdc,
  refresh,
  refreshSource,
  rowsFor,
  sdcLists,
  type Sheet,
} from '../../../../functions/src/knownCompetitions'
import { FakeRtdb } from './fakeRtdb'

// Known competitions (functions/src/knownCompetitions.ts, ADR 0009): each
// governing body's list read into one shape, with its quirks smoothed over,
// and stored a source at a time, replacing what that source had. Contact
// names and emails are never read. The data here is made up, in each feed's
// own shape.

// ScotDance Canada --------------------------------------------------------------

const HEADINGS = [
  null,
  'Date',
  'Title of Event & Type (Competition, Championship, Premiership, Workshop)',
  'Venue',
  'Venue Address',
  'City',
  'Competition Organizer',
  'Website Address of Organization',
  'Full Name of Contact',
  'Email address',
]
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
const row = (date: unknown, name: string, venue: string, address: string, city: string, organiser: string, site: string | null) =>
  [null, date, name, venue, address, city, organiser, site, 'Morag Contact', 'morag@example.test']

function sdcSheets(): Sheet[] {
  const top = [
    [null, '2026 ScotDance Canada Event List', null],
    [null, 'Check with Organizer whether an event is closed within a province or region.', null],
    HEADINGS,
  ]
  return [
    {
      sheet: 'DATE',
      data: [
        ...top,
        [null, 'JAN', null],
        row(day('2026-01-10'), 'EHDA Back to Class Workshop', 'Step by Step', '449 Sioux Road', 'Sherwood Park', 'Edmonton Highland Dancing Association', 'https://ehda.ca/'),
        row(day('2026-01-17'), 'CHDA Pipe Practice', 'TBD', 'TBD', '', 'Calgary Highland Dance Association', 'www.chda.ab.ca'),
        row(day('2026-01-24'), 'ECHDA January Competition', 'A. Y. Jackson Secondary School', '50 Francine Dr,', 'North York', 'Eastern Canada HighIand Dancers’ Alliance', 'www.echda.com'),
        [null, 'JUL', null],
        // A row per day, one event.
        row(day('2026-07-04'), 'Canmore Highland Games', 'Centennial Park', '', 'Canmore', 'Canmore Highland Games Society', null),
        row(day('2026-07-05'), 'Canmore Highland Games', '', '', 'Canmore', 'Calgary Highland Dance Association', 'canmorehighlandgames.ca'),
        // Dated last year on this year's list.
        row(day('2025-07-25'), 'Festival of the Tartans', 'New Glasgow Stadium', '', 'New Glasgow', 'Festival of the Tartans', 'mail@tartans.test'),
        [null, 'OCT', null],
        row('Oct 24-25', 'Fall Classic Competition and Workshop', 'Hall', '', 'Winnipeg', 'Manitoba Highland Dance Association', null),
        row('Jul 31-Aug 1', 'Summer Championships', 'Arena', '', 'Halifax', 'Nova Scotia Highland Dance', null),
      ],
    },
    {
      sheet: 'PROV',
      data: [
        ...top,
        [null, 'ALBERTA', null],
        row(day('2025-01-24'), 'Canmore Highland Games', 'Centennial Park', '', 'Canmore', 'Canmore Highland Games Society', null),
        [null, 'MANITOBA', null],
        row('Oct 24-25', 'Fall Classic Competition and Workshop', 'Hall', '', 'Winnipeg', 'Manitoba Highland Dance Association', null),
        [null, 'NOVA SCOTIA', null],
        row(day('2025-07-25'), 'Festival of the Tartans', 'New Glasgow Stadium', '', 'New Glasgow', 'Festival of the Tartans', null),
        [null, 'ONTARIO', null],
        row(day('2025-01-24'), 'ECHDA January Competition', 'A. Y. Jackson Secondary School', '50 Francine Dr,', 'North York', 'Eastern Canada HighIand Dancers’ Alliance', null),
      ],
    },
  ]
}

describe('ScotDance Canada’s event list', () => {
  const list = readSdc(sdcSheets())
  const named = (name: string) => list.find((k) => k.name === name)

  it('keeps competitions, not workshops or practices (unless they’re both)', () => {
    expect(list.map((k) => k.name)).toEqual([
      'ECHDA January Competition',
      'Canmore Highland Games',
      'Festival of the Tartans',
      'Summer Championships',
      'Fall Classic Competition and Workshop',
    ])
  })

  it('reads its dates, text ones too, a row per day as one, and a slipped year as the list’s', () => {
    expect(named('ECHDA January Competition')).toMatchObject({ date: '2026-01-24' })
    expect(named('ECHDA January Competition')?.end).toBeUndefined()
    expect(named('Canmore Highland Games')).toMatchObject({ date: '2026-07-04', end: '2026-07-05', website: 'https://canmorehighlandgames.ca/' })
    expect(named('Festival of the Tartans')).toMatchObject({ date: '2026-07-25' })
    expect(named('Fall Classic Competition and Workshop')).toMatchObject({ date: '2026-10-24', end: '2026-10-25' })
    expect(named('Summer Championships')).toMatchObject({ date: '2026-07-31', end: '2026-08-01' })
  })

  it('takes the province from the sheet that groups them, and leaves out what isn’t there yet', () => {
    expect(named('ECHDA January Competition')).toMatchObject({
      venue: 'A. Y. Jackson Secondary School',
      address: '50 Francine Dr',
      locality: 'North York',
      region: 'ON',
      country: 'CA',
      website: 'https://www.echda.com/',
      organiser: 'Eastern Canada HighIand Dancers’ Alliance',
    })
    expect(named('Canmore Highland Games')?.region).toBe('AB')
    expect(named('Festival of the Tartans')).toMatchObject({ region: 'NS', website: '' })
  })

  it('never reads a contact’s name or email', () => {
    expect(JSON.stringify(list)).not.toMatch(/Morag|example\.test/)
  })

  it('reads nothing from a sheet it doesn’t recognise', () => {
    expect(readSdc([{ sheet: 'Sheet1', data: [['a', 'b'], ['c', 'd']] }])).toEqual([])
    expect(readSdc([])).toEqual([])
  })

  it('finds the list on its page by the link’s words, since the file’s name changes', () => {
    const html = `<p><a class="nectar-button" role=button target=_blank href=https://scotdance.ca/wp-content/uploads/2026/10/2026-SDC-Event-List_04Oct26.xlsx data-color-override=false><span>View 2026 SDC Events List</span></a>
      <a href="/wp-content/uploads/2026/09/2027-list.xlsx">View&nbsp;2027 SDC Events List</a>
      <a href="/other.pdf">View 2026 SDC Rules</a></p>`
    expect(sdcLists(html, 'https://scotdance.ca/events/')).toEqual([
      { year: 2026, url: 'https://scotdance.ca/wp-content/uploads/2026/10/2026-SDC-Event-List_04Oct26.xlsx' },
      { year: 2027, url: 'https://scotdance.ca/wp-content/uploads/2026/09/2027-list.xlsx' },
    ])
    expect(sdcLists('<a href="x.xlsx">Events</a>', 'https://scotdance.ca/events/')).toEqual([])
  })
})

// ScotDance USA ------------------------------------------------------------------

const ics = (...events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap((e) => ['BEGIN:VEVENT', e.trim(), 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n')

const USA = ics(
  `DTSTART;VALUE=DATE:20270417
DTEND;VALUE=DATE:20270419
DESCRIPTION:<u><a href="http://www.lochnorman.test" target="_blank">www.loch
 norman.test</a></u><br>Two days in April.
LOCATION:4431 Neck Rd\\, Huntersville\\, NC 28078\\, USA
SUMMARY:(SE) Carolinas Open Championship and Loch Norman Highland Games Dan
 ce Competition
ATTACH;FILENAME=Entry Form.pdf;FMTTYPE=application/pdf:https://drive.google.com/open?id=1`,
  `DTSTART;VALUE=DATE:20270605
DTEND;VALUE=DATE:20270606
DESCRIPTION:Entry form: https://drive.google.com/open?id=2 and more at https://scot.test/cary
LOCATION:Resurrection Lutheran Church\\, 100 W Lochmere Dr\\, Cary\\, NC 27518\\, USA
SUMMARY:(SE) Pat Johnston Memorial Competitions`,
  `DTSTART;VALUE=DATE:20270606
DTEND;VALUE=DATE:20270607
LOCATION:Washington County Fairgrounds\\, 2151 N Main St\\, Washington\\, PA 15301\\, USA
SUMMARY:(NW) Portland Highland Games`,
  `DTSTART;VALUE=DATE:20270116
DTEND;VALUE=DATE:20270118
LOCATION:159 E Center St.\\, Lehi\\, Utah 84043
SUMMARY:(SE) Central Florida PrePremier Competition\\; `,
  `DTSTART;VALUE=DATE:20270320
DTEND;VALUE=DATE:20270321
STATUS:CANCELLED
SUMMARY:(E) Called Off Games`,
  `DTSTART;VALUE=DATE:20270321
DTEND;VALUE=DATE:20270322
SUMMARY:(E) Judges’ Workshop`,
  `DTSTART;VALUE=DATE:20270808
DTEND;VALUE=DATE:20270809
LOCATION:Spokane\\, WA\\, USA
SUMMARY:(NW) Spokane Highland Games Dance Competition`,
)

describe('ScotDance USA’s calendar', () => {
  const list = readScotDanceUsa(USA)
  const named = (name: string) => list.find((k) => k.name === name)

  it('takes the region off each name, and leaves out what’s cancelled or isn’t a competition', () => {
    expect(list.map((k) => k.name)).toEqual([
      'Carolinas Open Championship and Loch Norman Highland Games Dance Competition',
      'Pat Johnston Memorial Competitions',
      'Portland Highland Games',
      'Central Florida PrePremier Competition',
      'Spokane Highland Games Dance Competition',
    ])
  })

  it('reads the end as the day before DTEND (it’s exclusive)', () => {
    expect(named('Carolinas Open Championship and Loch Norman Highland Games Dance Competition')).toMatchObject({ date: '2027-04-17', end: '2027-04-18' })
    expect(named('Pat Johnston Memorial Competitions')).toMatchObject({ date: '2027-06-05' })
    expect(named('Pat Johnston Memorial Competitions')?.end).toBeUndefined()
  })

  it('reads the venue, street, town and state from the address', () => {
    expect(named('Carolinas Open Championship and Loch Norman Highland Games Dance Competition')).toMatchObject({
      venue: '',
      address: '4431 Neck Rd',
      locality: 'Huntersville',
      region: 'NC',
      country: 'US',
    })
    expect(named('Pat Johnston Memorial Competitions')).toMatchObject({
      venue: 'Resurrection Lutheran Church',
      address: '100 W Lochmere Dr',
      locality: 'Cary',
      region: 'NC',
    })
    // A town that's also a state's name.
    expect(named('Portland Highland Games')).toMatchObject({ venue: 'Washington County Fairgrounds', locality: 'Washington', region: 'PA' })
    // A state written out, and no country.
    expect(named('Central Florida PrePremier Competition')).toMatchObject({ address: '159 E Center St.', locality: 'Lehi', region: 'UT', country: 'US' })
    expect(named('Spokane Highland Games Dance Competition')).toMatchObject({ venue: '', address: '', locality: 'Spokane', region: 'WA' })
  })

  it('takes the website from the description, not a shared entry form', () => {
    expect(named('Carolinas Open Championship and Loch Norman Highland Games Dance Competition')?.website).toBe('http://www.lochnorman.test/')
    expect(named('Pat Johnston Memorial Competitions')?.website).toBe('https://scot.test/cary')
    expect(named('Portland Highland Games')?.website).toBe('')
  })
})

// RSOBHD -----------------------------------------------------------------------------

const RSOBHD = ics(
  `UID:1@rsobhd.net
DTSTART;TZID=Europe/London;VALUE=DATE:20261017
DTEND;TZID=Europe/London;VALUE=DATE:20261018
URL:https://www.rsobhd.test/events/erne/
SUMMARY:Erne Highland Dancing Competition - Enniskillen
CATEGORIES:Competition
LOCATION:St Macartin's Cathedral Hall\\, 2 Halls Lane\\, Enniskillen\\, BT74 7DR\\, United Kingdom`,
  `UID:2@rsobhd.net
DTSTART;TZID=Europe/London;VALUE=DATE:20261017
DTEND;TZID=Europe/London;VALUE=DATE:20261018
SUMMARY:Tayside HDA - Monikie Festival
CATEGORIES:Competition
LOCATION:Monikie Village Hall\\, .\\, Monikie\\, DD5 3QA\\, United Kingdom`,
  `UID:3@rsobhd.net
DTSTART;TZID=Australia/Brisbane;VALUE=DATE:20261017
DTEND;TZID=Australia/Brisbane;VALUE=DATE:20261019
SUMMARY:South Queensland Scottish National Dance Premierships
CATEGORIES:Championship,Scottish National Dance Premiership
LOCATION:Birkdale South State School\\, Barron Road\\, Birkdale\\, QLD\\, 4159\\, Australia`,
  `UID:4@rsobhd.net
DTSTART;TZID=America/Edmonton:20261017T111500
DTEND;TZID=America/Edmonton:20261017T131500
SUMMARY:2027 Championship Steps
CATEGORIES:Judges CPD Lecture,Lecture
LOCATION:Holiday Inn Express\\, 6433 Orr Drive\\, Red Deer\\, AB\\, T4P 1A6\\, Canada`,
  `UID:5@rsobhd.net
DTSTART;TZID=Europe/London:20261018T134500
DTEND;TZID=Europe/London:20261018T160000
SUMMARY:Competition Organisers Meeting Online
CATEGORIES:Competition Organisers Meeting
LOCATION:Online via Zoom\\, Online via Zoom\\, Online via Zoom\\, United Kingdom`,
  `UID:6@rsobhd.net
DTSTART;TZID=Europe/London;VALUE=DATE:20261024
DTEND;TZID=Europe/London;VALUE=DATE:20261025
SUMMARY:Rangitikei and Districts Open Championships
CATEGORIES:Championship
LOCATION:.\\, .\\, Marton\\, New Zealand`,
  `UID:7@rsobhd.net
DTSTART;TZID=Europe/London:20261024T000000
DTEND;TZID=Europe/London:20261024T235900
SUMMARY:Canada's Capital City Open Championships
CATEGORIES:Championship
LOCATION:.\\, .\\, Orleans \\, ON\\, Canada`,
  `UID:8@rsobhd.net
DTSTART;TZID=Europe/London;VALUE=DATE:20261025
DTEND;TZID=Europe/London;VALUE=DATE:20261026
SUMMARY:Grampian Festivals - New Pitsligo
CATEGORIES:Competition
LOCATION:The Gym at Aberdeen International Business Park\\, Aker Solutions\\, Building 3\\, Dyce Drive\\, Aberdeen\\, AB21 0BR\\, United Kingdom`,
  `UID:9@rsobhd.net
DTSTART;TZID=Europe/London;VALUE=DATE:20261129
DTEND;TZID=Europe/London;VALUE=DATE:20261130
SUMMARY:Jigs & Jingle Bells
CATEGORIES:Competition
LOCATION:Maplefields Academy\\, Tower Hill Road\\, Corby\\, Northants\\, NN18 0TH\\, United Kingdom`,
  `UID:10@rsobhd.net
DTSTART;TZID=Europe/London;VALUE=DATE:20261031
DTEND;TZID=Europe/London;VALUE=DATE:20261101
SUMMARY:Central Highland Dancing Association - Westpark
CATEGORIES:Competition
LOCATION:Bo'Ness Academy\\, .\\, .\\, United Kingdom`,
)

describe('RSOBHD’s calendar', () => {
  const list = readRsobhd(RSOBHD)
  const named = (name: string) => list.find((k) => k.name === name)

  it('keeps competitions, championships and premierships, not lectures or meetings', () => {
    expect(list.map((k) => k.name)).toEqual([
      'Erne Highland Dancing Competition - Enniskillen',
      'Tayside HDA - Monikie Festival',
      'South Queensland Scottish National Dance Premierships',
      'Rangitikei and Districts Open Championships',
      'Canada\'s Capital City Open Championships',
      'Grampian Festivals - New Pitsligo',
      'Jigs & Jingle Bells',
      'Central Highland Dancing Association - Westpark',
    ])
  })

  it('takes the country from the address, and a UK nation from its postcode', () => {
    expect(named('Erne Highland Dancing Competition - Enniskillen')).toMatchObject({
      date: '2026-10-17',
      venue: 'St Macartin\'s Cathedral Hall',
      address: '2 Halls Lane',
      locality: 'Enniskillen',
      region: 'Northern Ireland',
      country: 'GB',
      website: 'https://www.rsobhd.test/events/erne/',
    })
    expect(named('Tayside HDA - Monikie Festival')).toMatchObject({ venue: 'Monikie Village Hall', address: '', locality: 'Monikie', region: 'Scotland' })
    expect(named('Jigs & Jingle Bells')).toMatchObject({ locality: 'Corby', region: 'England' })
    expect(named('Grampian Festivals - New Pitsligo')).toMatchObject({
      venue: 'The Gym at Aberdeen International Business Park',
      address: 'Aker Solutions, Building 3, Dyce Drive',
      locality: 'Aberdeen',
      region: 'Scotland',
    })
    // No postcode: the UK, but which nation isn't said.
    expect(named('Central Highland Dancing Association - Westpark')).toMatchObject({ venue: 'Bo\'Ness Academy', locality: '', region: '', country: 'GB' })
    expect(named('South Queensland Scottish National Dance Premierships')).toMatchObject({ end: '2026-10-18', locality: 'Birkdale', region: 'QLD', country: 'AU' })
    expect(named('Rangitikei and Districts Open Championships')).toMatchObject({ venue: '', locality: 'Marton', country: 'NZ' })
    // A timed one is on its own day.
    expect(named('Canada\'s Capital City Open Championships')).toMatchObject({ date: '2026-10-24', locality: 'Orleans', region: 'ON', country: 'CA' })
    expect(named('Canada\'s Capital City Open Championships')?.end).toBeUndefined()
  })
})

describe('reading the feeds', () => {
  it('unfolds lines, and keeps each property’s first', () => {
    const [event] = readIcs('BEGIN:VEVENT\r\nSUMMARY:Long\r\n  name\r\nATTACH:a\r\nATTACH:b\r\nDTSTART;VALUE=DATE:20270101\r\nEND:VEVENT')
    expect(event.SUMMARY.value).toBe('Long name')
    expect(event.ATTACH.value).toBe('a')
    expect(event.DTSTART).toEqual({ params: { VALUE: 'DATE' }, value: '20270101' })
  })

  it('reads the days, with an all-day end exclusive and a timed one inclusive', () => {
    const days = (start: string, end?: string) => icsDays(readIcs(`BEGIN:VEVENT\nDTSTART${start}\n${end ? `DTEND${end}\n` : ''}END:VEVENT`)[0])
    expect(days(';VALUE=DATE:20270101', ';VALUE=DATE:20270102')).toEqual({ date: '2027-01-01' })
    expect(days(';VALUE=DATE:20270101', ';VALUE=DATE:20270104')).toEqual({ date: '2027-01-01', end: '2027-01-03' })
    expect(days(':20270101T090000', ':20270102T170000')).toEqual({ date: '2027-01-01', end: '2027-01-02' })
    expect(days(';VALUE=DATE:20270101')).toEqual({ date: '2027-01-01' })
    expect(days(':soon')).toBeNull()
  })

  it('knows countries by name, and the UK’s nations', () => {
    expect(countryOf('United Kingdom')).toEqual({ country: 'GB' })
    expect(countryOf('Switzerland')).toEqual({ country: 'CH' })
    expect(countryOf('USA')).toEqual({ country: 'US' })
    expect(countryOf('Scotland')).toEqual({ country: 'GB', region: 'Scotland' })
    expect(countryOf('Glasgow')).toBeNull()
  })

  it('reads an address with a venue first, or without', () => {
    expect(readPlace(['Change Centre', 'South Road', 'Dundee', 'United Kingdom'], { venueFirst: true })).toEqual({
      venue: 'Change Centre',
      address: 'South Road',
      locality: 'Dundee',
      region: '',
      country: 'GB',
    })
    expect(readPlace(['Hall', '12 Main St', '.', 'Scotland'], { venueFirst: true })).toEqual({
      venue: 'Hall',
      address: '12 Main St',
      locality: '',
      region: 'Scotland',
      country: 'GB',
    })
    expect(readPlace(['tbc', 'tbc', 'tbc', 'Queensland', 'Australia'], { venueFirst: true })).toEqual({
      venue: '',
      address: '',
      locality: '',
      region: 'QLD',
      country: 'AU',
    })
  })
})

// Organisations --------------------------------------------------------------------

describe('matching the organiser to an organisation here', () => {
  const ORGS = {
    echda: { name: 'Eastern Canada Highland Dancers’ Alliance', shortName: 'ECHDA' },
    sdab: { name: 'ScotDance Alberta' },
    chda: { name: 'Central Highland Dancing Association', shortName: 'CHDA' },
    fot: { name: 'Festival of the Tartans' },
  }

  it('by its name, whatever the capitals or punctuation, or its short name', () => {
    expect(organisationFor('Scotdance Alberta', ORGS)).toBe('sdab')
    expect(organisationFor('ECHDA', ORGS)).toBe('echda')
    expect(organisationFor('Eastern Canada Highland Dancers\' Alliance', ORGS)).toBe('echda')
  })

  it('with a slip or two in a long name', () => {
    expect(organisationFor('Eastern Canada HighIand Dancers’ Alliance', ORGS)).toBe('echda')
    expect(organisationFor('Festival of the Tartan', ORGS)).toBe('fot')
  })

  it('not by its initials, which another organisation can share', () => {
    expect(organisationFor('Calgary Highland Dance Association', ORGS)).toBeNull()
    expect(organisationFor('Festival of the Arts', ORGS)).toBeNull()
    expect(organisationFor('', ORGS)).toBeNull()
    expect(organisationFor(undefined, ORGS)).toBeNull()
  })
})

// Storing them ---------------------------------------------------------------------

describe('the rows stored', () => {
  const fetched = '2026-10-12T07:00:00.000Z'

  it('are keyed by source, date and name, with the organisation (not the organiser) and nothing blank', () => {
    const rows = rowsFor(
      'sdc',
      [
        { date: '2026-11-07', name: 'Fall Classic', venue: '', locality: 'Calgary', region: 'AB', country: 'CA', website: '', organiser: 'ScotDance Alberta' },
        { date: '2026-11-07', name: 'Fall Classic!', locality: 'Edmonton', country: 'CA' },
        // Long gone.
        { date: '2026-06-01', end: '2026-06-02', name: 'June Games', country: 'CA' },
        // Ended within the last three months: still offered.
        { date: '2026-08-01', end: '2026-08-02', name: 'August Games', country: 'CA' },
      ],
      { fetched, organisations: { sdab: { name: 'ScotDance Alberta' } } },
    )
    expect(rows).toEqual({
      'sdc:2026-11-07:fall-classic': {
        source: 'sdc',
        date: '2026-11-07',
        name: 'Fall Classic',
        locality: 'Calgary',
        region: 'AB',
        country: 'CA',
        organisations: { sdab: true },
        fetched,
      },
      'sdc:2026-11-07:fall-classic-2': { source: 'sdc', date: '2026-11-07', name: 'Fall Classic!', locality: 'Edmonton', country: 'CA', fetched },
      'sdc:2026-08-01:august-games': { source: 'sdc', date: '2026-08-01', end: '2026-08-02', name: 'August Games', country: 'CA', fetched },
    })
  })
})

describe('a run', () => {
  const NOW = new Date('2026-10-12T07:00:00.000Z')
  const response = (body: string, status = 200) => ({
    ok: status < 400,
    status,
    text: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
  })
  const feeds = (bodies: Record<string, string | number>) => async (url: string) => {
    const body = Object.entries(bodies).find(([part]) => url.includes(part))?.[1]
    if (body === undefined) throw new Error(`fetch failed: ${url}`)
    return typeof body === 'number' ? response('', body) : response(body)
  }
  const USA_ONE = ics(`DTSTART;VALUE=DATE:20270808
DTEND;VALUE=DATE:20270809
LOCATION:Spokane\\, WA\\, USA
SUMMARY:(NW) Spokane Highland Games`)

  function seeded() {
    const db = new FakeRtdb()
    db.write({
      'knownCompetitions/scotdance-usa:2027-01-01:old-games': { source: 'scotdance-usa', date: '2027-01-01', name: 'Old Games', country: 'US' },
      'knownCompetitions/rsobhd:2026-11-01:kept': { source: 'rsobhd', date: '2026-11-01', name: 'Kept', country: 'GB' },
      'knownCompetitions:runs/scotdance-usa': { at: '2026-09-01T07:00:00.000Z', ok: '2026-09-01T07:00:00.000Z', count: 1 },
    })
    return db
  }

  it('replaces that source’s rows, and leaves the others be', async () => {
    const db = seeded()
    expect(await refreshSource(db.ref(), 'scotdance-usa', { fetch: feeds({ 'calendar.google.com': USA_ONE }), now: NOW })).toEqual({ count: 1 })
    expect(db.read('knownCompetitions')).toEqual({
      'scotdance-usa:2027-08-08:spokane-highland-games': {
        source: 'scotdance-usa',
        date: '2027-08-08',
        name: 'Spokane Highland Games',
        locality: 'Spokane',
        region: 'WA',
        country: 'US',
        fetched: NOW.toISOString(),
      },
      'rsobhd:2026-11-01:kept': { source: 'rsobhd', date: '2026-11-01', name: 'Kept', country: 'GB' },
    })
    expect(db.read('knownCompetitions:runs/scotdance-usa')).toEqual({
      at: NOW.toISOString(),
      ok: NOW.toISOString(),
      count: 1,
      from: [expect.stringContaining('calendar.google.com')],
    })
  })

  it('that fails, or finds nothing, keeps the last good rows and says why', async () => {
    for (const fetch of [feeds({ 'calendar.google.com': 503 }), feeds({ 'calendar.google.com': ics() })]) {
      const db = seeded()
      const result = await refreshSource(db.ref(), 'scotdance-usa', { fetch, now: NOW })
      expect(result.error).toMatch(/answered 503|no competitions/)
      expect(Object.keys(db.read('knownCompetitions'))).toEqual(['scotdance-usa:2027-01-01:old-games', 'rsobhd:2026-11-01:kept'])
      expect(db.read('knownCompetitions:runs/scotdance-usa')).toEqual({
        at: NOW.toISOString(),
        ok: '2026-09-01T07:00:00.000Z',
        count: 1,
        error: result.error,
      })
    }
  })

  it('says so when ScotDance Canada’s page has no list on it', async () => {
    const db = seeded()
    const result = await refreshSource(db.ref(), 'sdc', { fetch: feeds({ 'scotdance.ca': '<a href="x">Events</a>' }), now: NOW })
    expect(result.error).toMatch(/no “View … SDC Events List” link/)
  })

  it('goes through every source, one failing not stopping the rest', async () => {
    const db = seeded()
    const results = await refresh(db.ref(), undefined, {
      fetch: feeds({ 'calendar.google.com': USA_ONE, 'scotdance.ca': 404, 'rsobhd.net': 500 }),
      now: NOW,
    })
    expect(results).toEqual({
      sdc: { error: 'scotdance.ca answered 404' },
      'scotdance-usa': { count: 1 },
      rsobhd: { error: 'www.rsobhd.net answered 500' },
    })
    expect(Object.keys(await refresh(db.ref(), 'rsobhd', { fetch: feeds({}), now: NOW }))).toEqual(['rsobhd'])
  })
})
