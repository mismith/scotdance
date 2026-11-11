// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { addCompetition, countryOf, type AddCompetitionInput } from '../../../../functions/src/mcp/submit'
import { explain } from '../../../../functions/src/mcp/toolkit'
import { fakeSession, type Json } from './mcpHarness'

const refused = async (p: Promise<unknown>, match: RegExp) => {
  const error = await p.then(() => null, (e: Error) => e)
  expect(error, 'should have been refused').not.toBeNull()
  expect(explain(error)).toMatch(match)
}

const world = (extra: Json = {}): Json => ({
  users: { u1: { email: 'pat@example.test', displayName: 'Pat Organiser' } },
  'users:permissions': { u1: { competitions: { old: true }, organisations: { o1: true } } },
  organisations: { o1: { name: 'Foothills Highland Dancing Association', shortName: 'FHDA' }, o2: { name: 'Prairie Games Society' } },
  competitions: {
    old: { name: 'Last Year', date: '2025-11-14', country: 'CA' },
    here: { name: 'Spring Games', date: '2026-11-14', location: 'Calgary, AB', venue: 'Telus Convention Centre', country: 'CA' },
    scot: { name: 'Cowal Gathering', date: '2026-11-14', location: 'Dunoon', country: 'GB', region: 'Scotland' },
  },
  knownCompetitions: {
    'sdc:2027-02-06:fall': { source: 'sdc', date: '2027-02-06', name: 'Winter Fling Championships', venue: 'Genesis Centre', address: '7555 Falconridge Blvd NE', locality: 'Calgary', region: 'AB', country: 'CA', organisations: { o2: true } },
  },
  venues: { v1: { name: 'Telus Convention Centre', locality: 'Calgary', region: 'AB', country: 'CA', lat: 51.045, lng: -114.06 } },
  'venues:index': { 'telus convention centre|calgary': { id: 'v1' } },
  ...extra,
})

const input = (extra: Partial<AddCompetitionInput> = {}): AddCompetitionInput => ({
  country: 'CA', date: '2027-03-06', name: 'Prairie Spring Championships', town: 'Red Deer, AB', acceptsAsIs: true, ...extra,
})

/** The submission trigger, stood in for: it approves (making the competition and its admin) or does not */
function timing(db: ReturnType<typeof fakeSession>, approve: boolean) {
  // (Today, in the tests: 2026-11-11)
  let clock = Date.UTC(2026, 10, 11)
  return {
    waitMs: 100,
    intervalMs: 10,
    now: () => clock,
    newId: () => 'sub1',
    sleep: async () => {
      clock += 10
      const sub = db.tree['competitions:submissions']?.sub1
      if (approve && sub && !db.tree.competitions.made) {
        db.tree.competitions.made = { ...sub.competition, submissionId: 'sub1' }
        db.tree['users:permissions'].u1.competitions.made = true
      }
    },
  }
}

describe('add_competition', () => {
  it('files the submission the form files, and says it was added straight away when the trigger approves it', async () => {
    const db = fakeSession(world())
    const out = await addCompetition(db.session, input({ venue: ' Westerner Park ', space: 'Exhibition Hall', registrationNumber: 'AB 27 1234', message: 'Hello', organisations: ['Foothills Highland Dancing Association'] }), timing(db, true))
    const sub = db.tree['competitions:submissions'].sub1
    expect(sub.competition).toEqual({
      name: 'Prairie Spring Championships', date: '2027-03-06', venue: 'Westerner Park', space: 'Exhibition Hall', location: 'Red Deer, AB', country: 'CA', sobhd: 'C-AB-CO-27-1234',
    })
    expect(sub.contact).toEqual({ name: 'Pat Organiser', email: 'pat@example.test', message: 'Hello', disclaimer: true })
    expect(sub.organisations).toEqual({ o1: true })
    expect(typeof sub.submitted).toBe('string')
    // submittedBy, receivedAt and the approval are the trigger's: nothing the form leaves to it is written here
    for (const key of ['submittedBy', 'receivedAt', 'approved', 'autoApproved', 'adminOf', 'review']) expect(sub[key]).toBeUndefined()
    expect(out.competition).toBe('made')
    expect(out.summary).toMatch(/^Added\. .*approved and they manage it now.*pat@example\.test/)
    expect(out.next).toMatch(/\/competitions\/made\/manage$/)
    expect(out.pin).toMatch(/^missing/)
    expect(out.registrationNote).toBe('The registration number is saved as C-AB-CO-27-1234.')
  })

  it('says it is waiting when it has not been approved, and why it may be (the checks a person makes)', async () => {
    const db = fakeSession(world())
    const out = await addCompetition(db.session, input({ name: 'PRAIRIE SPRING CHAMPIONSHIPS' }), timing(db, false))
    expect(out.competition).toBeUndefined()
    expect(out.summary).toMatch(/^Sent\. .*isn’t approved yet. It’s usually approved overnight.*pat@example\.test/)
    expect(out.likelyWaitingBecause).toEqual(['The name is in capitals'])
    expect(db.tree['competitions:submissions'].sub1.competition.name).toBe('PRAIRIE SPRING CHAMPIONSHIPS')
  })

  it('saves the registration number as the form’s preview would, and says so', async () => {
    const db = fakeSession(world())
    const tidy = await addCompetition(db.session, input({ registrationNumber: 'C-AB-CO-27-1234 ' }), timing(db, true))
    expect(db.tree['competitions:submissions'].sub1.competition.sobhd).toBe('C-AB-CO-27-1234')
    expect(tidy.registrationNote).toBeUndefined()
    const loose = fakeSession(world())
    const out = await addCompetition(loose.session, input({ registrationNumber: 'ab 27/1234' }), timing(loose, true))
    expect(out.registrationWarning).toMatch(/“ab 27\/1234” isn’t in a format it knows, so it is saved as typed/)
    expect(loose.tree['competitions:submissions'].sub1.competition.sobhd).toBe('ab 27/1234')
  })

  it('checks what the form checks, and nothing else', async () => {
    const db = fakeSession(world())
    await refused(addCompetition(db.session, input({ name: '   ' }), timing(db, true)), /needs a name/)
    await refused(addCompetition(db.session, input({ date: '2027-02-30' }), timing(db, true)), /not a date/)
    await refused(addCompetition(db.session, input({ date: 'March 6' }), timing(db, true)), /YYYY-MM-DD/)
    await refused(addCompetition(db.session, input({ town: ' ' }), timing(db, true)), /needs a town or city/)
    await refused(addCompetition(db.session, { ...input(), acceptsAsIs: false as unknown as true }, timing(db, true)), /has to accept “I accept ScotDance.app comes as is, with no guarantees”/)
    await refused(addCompetition(db.session, input({ country: 'Narnia' }), timing(db, true)), /isn’t a country/)
    await refused(addCompetition(db.session, input({ organisations: ['Nonesuch Society'] }), timing(db, true)), /No organisation matches/)
    await refused(addCompetition(db.session, input({ sameWeekendAs: 'a/b' }), timing(db, true)), /id of a submission/)
    expect(db.tree['competitions:submissions']).toBeUndefined()
    // A date that has passed, a name in lowercase: the form sends them (the reviewer looks); so does this
    await addCompetition(db.session, input({ date: '2020-01-04', name: 'Old Games Day' }), timing(db, false))
    expect(db.tree['competitions:submissions'].sub1.competition.date).toBe('2020-01-04')
  })

  it('needs an email and a name to send under', async () => {
    const noEmail = fakeSession(world({ users: { u1: { displayName: 'Pat' } } }))
    await refused(addCompetition(noEmail.session, input(), timing(noEmail, true)), /no email address/)
    const noName = fakeSession(world({ users: { u1: { email: 'pat@example.test' } } }))
    await refused(addCompetition(noName.session, input(), timing(noName, true)), /pass it as yourName/)
    await addCompetition(noName.session, input({ yourName: 'Pat O' }), timing(noName, true))
    expect(noName.tree['competitions:submissions'].sub1.contact.name).toBe('Pat O')
  })

  it('stores a UK nation as the form does', async () => {
    const db = fakeSession(world())
    await addCompetition(db.session, input({ country: 'GB-SCT', town: 'Dunoon' }), timing(db, true))
    expect(db.tree['competitions:submissions'].sub1.competition).toMatchObject({ country: 'GB', region: 'Scotland' })
    expect(countryOf('Scotland')).toMatchObject({ iso: 'GB', region: 'Scotland' })
    expect(countryOf('canada')).toMatchObject({ iso: 'CA' })
    expect(countryOf('nz')).toMatchObject({ iso: 'NZ' })
  })

  it('refuses one that is already on ScotDance.app that day, until the organiser says it is another', async () => {
    const db = fakeSession(world())
    const same = input({ date: '2026-11-14', name: 'Spring Games 2026', town: 'Calgary, AB', venue: 'Telus Convention Centre' })
    await refused(addCompetition(db.session, same, timing(db, true)), /already on ScotDance\.app: “Spring Games” \(2026-11-14, Calgary, AB, id here\).*notTheOneAlreadyHere: true/)
    expect(db.tree['competitions:submissions']).toBeUndefined()
    await addCompetition(db.session, { ...same, notTheOneAlreadyHere: true }, timing(db, true))
    expect(db.tree['competitions:submissions'].sub1.competition.name).toBe('Spring Games 2026')
  })

  it('does not mistake another country’s competition that day, or a different one, for it; it lists them', async () => {
    const db = fakeSession(world())
    const out = await addCompetition(db.session, input({ date: '2026-11-14', name: 'Cowal Gathering', town: 'Dunoon', country: 'GB-ENG' }), timing(db, true))
    // (Cowal is in Scotland, which England’s is not; Spring Games, in Canada, is not in either)
    expect(out.alsoThatDay).toBeUndefined()
    const other = fakeSession(world())
    const out2 = await addCompetition(other.session, input({ date: '2026-11-14', name: 'Calgary Fall Classic', town: 'Calgary, AB', venue: 'Genesis Centre' }), timing(other, true))
    expect(out2.alsoThatDay).toEqual(['Spring Games (2026-11-14, Calgary, AB)'])
  })

  it('fills what is left out from a listed competition it matches, never what was given', async () => {
    const db = fakeSession(world())
    const out = await addCompetition(db.session, input({ date: '2027-02-06', name: 'Winter Fling Championships 2027', town: 'Calgary, AB' }), timing(db, true))
    const sub = db.tree['competitions:submissions'].sub1
    expect(sub.competition).toMatchObject({ venue: 'Genesis Centre', address: '7555 Falconridge Blvd NE', location: 'Calgary, AB' })
    expect(sub.organisations).toEqual({ o2: true })
    expect(out.matchedListed).toEqual({ name: 'Winter Fling Championships', source: 'sdc', filledIn: ['venue', 'address', 'organisations'] })
    const given = fakeSession(world())
    await addCompetition(given.session, input({ date: '2027-02-06', name: 'Winter Fling Championships', town: 'Calgary, AB', venue: 'Somewhere Else', organisations: ['o1'] }), timing(given, true))
    expect(given.tree['competitions:submissions'].sub1.competition.venue).toBe('Somewhere Else')
    expect(given.tree['competitions:submissions'].sub1.organisations).toEqual({ o1: true })
  })

  it('puts it on the map when the venue is one ScotDance.app already knows (same name, same town)', async () => {
    const db = fakeSession(world())
    const out = await addCompetition(db.session, input({ town: 'Calgary, AB', venue: 'TELUS Convention Centre' }), timing(db, true))
    expect(db.tree['competitions:submissions'].sub1.competition).toMatchObject({ lat: 51.045, lng: -114.06, country: 'CA', region: 'AB', locality: 'Calgary' })
    expect(out.pin).toMatch(/on the map/)
    // Another town's venue of that name is a different place
    const far = fakeSession(world())
    const out2 = await addCompetition(far.session, input({ town: 'Brisbane, QLD', country: 'AU', venue: 'Telus Convention Centre' }), timing(far, true))
    expect(far.tree['competitions:submissions'].sub1.competition.lat).toBeUndefined()
    expect(out2.pin).toMatch(/^missing/)
  })

  it('links the next day of the same event to the submission just sent', async () => {
    const db = fakeSession(world())
    await addCompetition(db.session, input({ sameWeekendAs: 'prevSub' }), timing(db, true))
    expect(db.tree['competitions:submissions'].sub1.linkedTo).toBe('prevSub')
  })
})
