import { expect, test } from '@playwright/test'
import { dbGet, dbRemove, dbSet, uid } from './support/emulator'
import { account, as, assistant, type Account } from './support/backend'

// firebase.rules.json with real ID tokens: every write the app makes as a
// parent and as an organiser (not a system admin) is allowed, and what must
// stay refused is. No browser needed, so it runs once (desktop project).

test.skip(({ isMobile }) => isMobile, 'Database rules only: no need to run per device')
test.describe.configure({ mode: 'serial' })

let pub: string
let priv: string
let org: Account
let parent: Account
let stranger: Account

const allowed = async (label: string, answer: Promise<{ ok: boolean; status: number }>) => {
  const a = await answer
  expect.soft(a.ok, `${label} should be allowed (got ${a.status})`).toBe(true)
}
const refused = async (label: string, answer: Promise<{ ok: boolean; status: number }>) => {
  const a = await answer
  expect.soft(a.ok, `${label} should be refused (got ${a.status})`).toBe(false)
}

test.beforeAll(async () => {
  pub = uid('rules-pub')
  priv = uid('rules-priv')
  ;[org, parent, stranger] = await Promise.all([
    account(`${uid('rules-org')}@example.test`),
    account(`${uid('rules-parent')}@example.test`),
    account(`${uid('rules-stranger')}@example.test`),
  ])
  for (const [id, published] of [
    [pub, true],
    [priv, false],
  ] as const) {
    await dbSet(`competitions/${id}`, { name: `Rules ${id}`, date: '2026-10-01', published, listed: published })
    await dbSet(`competitions:data/${id}`, {
      dancers: { d1: { firstName: 'Rules', lastName: 'Dancer', number: '1' } },
      staff: { s1: { type: 'Judge', firstName: 'Rules', lastName: 'Judge' } },
    })
    await dbSet(`users:permissions/${org.uid}/competitions/${id}`, true)
    await dbSet(`competitions:permissions/${id}/users/${org.uid}`, true)
  }
})

test.afterAll(async () => {
  for (const id of [pub, priv]) {
    await dbRemove(`competitions:data/${id}`)
    await dbRemove(`competitions/${id}`)
    await dbRemove(`competitions:permissions/${id}`)
  }
  for (const who of [org, parent, stranger]) {
    await dbRemove(`users:permissions/${who.uid}`)
    await dbRemove(`users/${who.uid}`)
    await dbRemove(`users:favorites/${who.uid}`)
    await dbRemove(`users:alertsOff/${who.uid}`)
    await dbRemove(`users:dancerColors/${who.uid}`)
    await dbRemove(`users:inbox/${who.uid}`)
    await dbRemove(`dancers:views/${who.uid}`)
    await dbRemove(`dancers:viewFlags/${who.uid}`)
  }
  await dbRemove('dancers:hidden/-RulesHide')
})

test('Entries owns registration fields even when clients delete fields or remove the ownership marker', async () => {
  const path = `competitions/${pub}`
  const owner = { competitionId: pub, organisationId: 'entries-org', targetId: pub, revision: 1, bindingId: 'current-binding' }
  await refused('an organiser forges Entries ownership', as(org, 'PUT', `${path}/entriesRegistration`, owner))
  await dbSet(`${path}/entriesRegistration`, owner)
  await dbSet(`${path}/registrationURL`, 'https://entries.scotdance.app/enter/entries-org/example')
  await dbSet(`${path}/registrationStart`, 1800000000000)
  await dbSet(`${path}/registrationEnd`, 1800100000000)
  await dbSet(`${path}/entriesRegistrationReleasedBinding`, 'previous-binding')
  const bot = await assistant(org)
  try {
    for (const who of [org, bot]) {
      await allowed('unrelated competition edits remain possible', as(who, 'PATCH', path, { description: 'An unchanged registration' }))
      await refused('change registration URL', as(who, 'PATCH', path, { registrationURL: 'https://other.test' }))
      await refused('delete registration URL', as(who, 'DELETE', `${path}/registrationURL`))
      await refused('delete registration dates', as(who, 'PATCH', path, { registrationStart: null, registrationEnd: null }))
      await refused('remove ownership', as(who, 'DELETE', `${path}/entriesRegistration`))
      await refused('change ownership', as(who, 'PATCH', `${path}/entriesRegistration`, { competitionId: 'other' }))
      await refused('change service binding', as(who, 'PATCH', `${path}/entriesRegistration`, { bindingId: 'forged' }))
      await refused('remove released binding', as(who, 'DELETE', `${path}/entriesRegistrationReleasedBinding`))
      await refused('remove lock and overwrite together', as(who, 'PATCH', '', { [`${path}/entriesRegistration`]: null, [`${path}/registrationURL`]: 'https://other.test' }))
    }
    await dbSet(`users:permissions/${org.uid}/admin`, true)
    await refused('system-admin client deletes a managed date', as(org, 'DELETE', `${path}/registrationEnd`))
  } finally {
    await dbRemove(`users:permissions/${org.uid}/admin`)
    for (const field of ['entriesRegistration', 'entriesRegistrationReleasedBinding', 'registrationURL', 'registrationStart', 'registrationEnd', 'description']) await dbRemove(`${path}/${field}`)
  }
})

test('an Entries submitter can watch their own approval but cannot forge readiness or another submitter', async () => {
  const submission = uid('entries-submission')
  const path = `competitions:submissions/${submission}`
  const value = { competition: { name: 'Entries Highland Competition', date: '2027-07-05', location: 'Calgary' }, submittedBy: parent.uid, returnTo: 'entries' }
  try {
    await refused('forge completed review', as(parent, 'PUT', path, { ...value, entriesReady: true }))
    await refused('forge another submitter', as(parent, 'PUT', path, { ...value, submittedBy: stranger.uid }))
    await allowed('submit for Entries', as(parent, 'PUT', path, value))
    await allowed('read own approval progress', as(parent, 'GET', path))
    await refused('read another organiser’s submission', as(stranger, 'GET', path))
    await refused('mark own submission ready', as(parent, 'PATCH', path, { entriesReady: true }))
  } finally { await dbRemove(path) }
})

test('public reads: published data and profiles yes, private data and other people no', async () => {
  await allowed('signed-out read of a published competition’s data', as(null, 'GET', `competitions:data/${pub}/dancers`))
  for (const section of ['groups', 'categories', 'dances', 'platforms', 'schedule', 'draws', 'results', 'points', 'staff'])
    await allowed(`signed-out read of a published competition’s ${section}`, as(null, 'GET', `competitions:data/${pub}/${section}`))
  // Invites (emails, open invite ids) stay private even once published:
  // an open invite id is all it takes to accept it.
  await refused('signed-out read of a published competition’s invites', as(null, 'GET', `competitions:data/${pub}/invites`))
  await refused('a parent listing a published competition’s invites', as(parent, 'GET', `competitions:data/${pub}/invites`))
  await refused('signed-out read of a published competition’s whole data', as(null, 'GET', `competitions:data/${pub}`))
  await allowed('an organiser listing their competition’s invites', as(org, 'GET', `competitions:data/${pub}/invites`))
  await refused('signed-out read of a private competition’s data', as(null, 'GET', `competitions:data/${priv}/dancers`))
  await refused('signed-out read of a private competition’s staff', as(null, 'GET', `competitions:data/${priv}/staff`))
  // Listed (not yet published): the judges show with the date and venue.
  await dbSet(`competitions/${priv}/listed`, true)
  try {
    await allowed('signed-out read of a listed competition’s staff', as(null, 'GET', `competitions:data/${priv}/staff`))
    await refused('signed-out read of a listed competition’s dancers', as(null, 'GET', `competitions:data/${priv}/dancers`))
  } finally {
    await dbSet(`competitions/${priv}/listed`, false)
  }
  for (const node of ['dancers:index/x', 'judges/-x', 'pipers:index', 'venues/-x', `competitions:changed/${pub}`]) await allowed(`signed-out read of /${node}`, as(null, 'GET', node))
  // Profiles (and the dancers' name index) are read one at a time; the whole trees are too big to hand out.
  for (const node of ['dancers', 'dancers:index', 'judges', 'pipers', 'venues']) await refused(`signed-out read of all /${node}`, as(null, 'GET', node))
  // Ids kept for people who aren't showing (e.g. in a competition that was unpublished) stay private.
  await refused('signed-out read of /dancers:retired', as(null, 'GET', 'dancers:retired'))
  await refused('a parent reading /dancers:retired', as(parent, 'GET', 'dancers:retired'))
  await refused('signed-out read of a user', as(null, 'GET', `users/${parent.uid}`))
  await refused('reading someone else’s favourites', as(parent, 'GET', `users:favorites/${org.uid}`))
  await refused('reading someone else’s alerts turned off', as(parent, 'GET', `users:alertsOff/${org.uid}`))
  await refused('signed-out read of anyone’s alerts turned off', as(null, 'GET', `users:alertsOff/${parent.uid}`))
  await refused('reading someone else’s dancer colours', as(parent, 'GET', `users:dancerColors/${org.uid}`))
  await refused('a parent reading a competition’s admins', as(parent, 'GET', `competitions:permissions/${pub}`))
  await allowed('an organiser reading their competition’s admins', as(org, 'GET', `competitions:permissions/${pub}`))
  await allowed('an organiser reading their private competition', as(org, 'GET', `competitions:data/${priv}`))
})

test('a parent can save their own things and nothing else', async () => {
  const me = parent.uid
  await allowed('roles (useRoles)', as(parent, 'PATCH', `users/${me}`, { roles: { parent: true }, rolesAnsweredAt: Date.now() }))
  await allowed('display name', as(parent, 'PATCH', `users/${me}`, { displayName: 'Rules Parent' }))
  await allowed('favourite a dancer (name as the value)', as(parent, 'PUT', `users:favorites/${me}/dancers/-Agg1`, 'Rules Dancer'))
  await allowed('turn on a competition’s alerts', as(parent, 'PUT', `users:favorites/${me}/competitions/${pub}`, true))
  await allowed('the favourites migration (one multi-path write)', as(parent, 'PATCH', `users:favorites/${me}`, { 'dancers/-Agg2': 'Rules Dancer', 'dancers/-Agg1': null }))
  await allowed('choose a dancer colour', as(parent, 'PUT', `users:dancerColors/${me}/-Agg2`, 'dancer-3'))
  await allowed('clear a dancer colour', as(parent, 'PUT', `users:dancerColors/${me}/-Agg2`, null))
  await refused('a colour that isn’t a short string', as(parent, 'PUT', `users:dancerColors/${me}/-Agg2`, 'x'.repeat(17)))
  await refused('a colour that isn’t a string', as(parent, 'PUT', `users:dancerColors/${me}/-Agg2`, 3))
  const look = `users:dancerColors/${me}/-Agg2`
  await allowed(
    'weave a dancer a tartan',
    as(parent, 'PUT', look, { color: 'dancer-3', sett: 'P40 K16 A16 K2 B2', colors: { P: '#6a3fa0', A: '#14306b', B: '#48a4c0' } }),
  )
  await allowed('a tartan in black and white alone', as(parent, 'PUT', look, { color: 'dancer-3', sett: 'K16 W2' }))

  await allowed('back to a plain colour', as(parent, 'PUT', look, 'dancer-3'))
  await refused('a stripe the builder can’t make', as(parent, 'PUT', look, { color: 'dancer-3', sett: 'P41' }))
  await refused('more than fourteen stripes', as(parent, 'PUT', look, { color: 'dancer-3', sett: Array(15).fill('P2').join(' ') }))
  await refused('a tartan with no colour', as(parent, 'PUT', look, { sett: 'P16 K16' }))
  await refused('a tartan in a colour that isn’t one', as(parent, 'PUT', look, { color: 'red', sett: 'P16 K16' }))
  await refused('a stripe colour that isn’t a colour', as(parent, 'PUT', look, { color: 'dancer-3', sett: 'P16', colors: { P: 'navy' } }))
  await refused('a colour for black', as(parent, 'PUT', look, { color: 'dancer-3', sett: 'K16', colors: { K: '#6a3fa0' } }))
  await refused('anything else in a tartan', as(parent, 'PUT', look, { color: 'dancer-3', sett: 'P16 K16', note: 'hi' }))
  await refused('someone else’s colours', as(parent, 'PUT', `users:dancerColors/${org.uid}/-Agg2`, 'dancer-1'))
  await refused('someone else’s favourites', as(parent, 'PUT', `users:favorites/${org.uid}/dancers/x`, true))
  const submission = uid('rules-sub')
  await allowed('submit a competition', as(parent, 'PUT', `competitions:submissions/${submission}`, { competition: { name: 'Rules sub', date: '2026-11-01', location: 'Calgary, AB' }, contact: { email: 'p@example.test' }, submitted: new Date().toISOString() }))
  // What review needs to say anything: a name, a date and a town or city.
  const lacking = (competition: Record<string, unknown>) => ({ competition, contact: { email: 'p@example.test' }, submitted: new Date().toISOString() })
  await refused('submit one with nothing in it', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { contact: { email: 'p@example.test' }, submitted: new Date().toISOString() }))
  await refused('submit one with no name', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, lacking({ name: ' ', date: '2026-11-01', location: 'Calgary, AB' })))
  await refused('submit one with no date', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, lacking({ name: 'Rules sub', location: 'Calgary, AB' })))
  await refused('submit one with a date not as YYYY-MM-DD', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, lacking({ name: 'Rules sub', date: 'Nov 1', location: 'Calgary, AB' })))
  await refused('submit one with no town or city', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, lacking({ name: 'Rules sub', date: '2026-11-01' })))
  await refused('edit a submission once sent', as(parent, 'PATCH', `competitions:submissions/${submission}/competition`, { name: 'changed' }))
  await refused('submit one already approved', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { competition: { name: 'x' }, approved: new Date().toISOString() }))
  await refused('submit one already rejected (out of the queue)', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { competition: { name: 'x' }, rejected: new Date().toISOString() }))
  await refused('submit one with a reply to email', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { competition: { name: 'x' }, rejection: { reply: 'Hello' } }))
  await refused('submit one saying a reply went out', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { competition: { name: 'x' }, replied: new Date().toISOString() }))
  await refused('submit one making them an admin of an organisation', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { competition: { name: 'x' }, adminOf: { someOrg: true } }))
  await refused('reject their own submission', as(parent, 'PATCH', `competitions:submissions/${submission}`, { rejected: new Date().toISOString() }))
  await refused('signed out, submit', as(null, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { competition: { name: 'x' } }))
  await refused('grant themselves a competition', as(parent, 'PUT', `users:permissions/${me}/competitions/${pub}`, true))
  await refused('make themselves a system admin', as(parent, 'PUT', `users:permissions/${me}/admin`, true))
  await refused('stamp a competition as changed (functions do)', as(parent, 'PUT', `competitions:changed/${pub}/results`, 1))
  await refused('edit a competition', as(parent, 'PATCH', `competitions/${pub}`, { name: 'x' }))
  await refused('edit a competition’s dancers', as(parent, 'PATCH', `competitions:data/${pub}/dancers/d1`, { firstName: 'x' }))
  await refused('write a profile (aggregate)', as(parent, 'PATCH', 'dancers/-Agg', { name: 'x' }))
  await refused('publish a competition', as(parent, 'PUT', `competitions:published/${priv}`, true))
  await dbRemove(`competitions:submissions/${submission}`)
})

// A favourite dancer's alerts, turned off and on (ADR 0008): the user's own,
// written the way the app writes them (stores/favorites.ts).
test('a favourite dancer’s alerts are yours alone to turn off and on', async () => {
  const me = parent.uid
  const off = `users:alertsOff/${me}/dancers/-Agg3`
  await allowed(
    'favourite a dancer, alerts on (one write at the top)',
    as(parent, 'PATCH', '', { [`users:favorites/${me}/dancers/-Agg3`]: 'Rules Dancer', [off]: null }),
  )
  await allowed('turn their alerts off', as(parent, 'PUT', off, true))
  await allowed('read your own alerts turned off', as(parent, 'GET', `users:alertsOff/${me}`))
  expect(await dbGet(off)).toBe(true)
  await allowed('turn their alerts back on', as(parent, 'PUT', off, null))
  await refused('alerts off as anything but true', as(parent, 'PUT', off, 'yes'))
  await refused('alerts off as false', as(parent, 'PUT', off, false))
  await refused('anything but dancers under alerts off', as(parent, 'PUT', `users:alertsOff/${me}/competitions/${pub}`, true))
  await refused('someone else’s alerts', as(parent, 'PUT', `users:alertsOff/${org.uid}/dancers/-Agg3`, true))
  await refused('signed out', as(null, 'PUT', off, true))
  await allowed('turn their alerts off again', as(parent, 'PUT', off, true))
  await allowed(
    'unfavourite them, alerts off and all (one write at the top)',
    as(parent, 'PATCH', '', { [`users:favorites/${me}/dancers/-Agg3`]: null, [off]: null }),
  )
  expect(await dbGet(off)).toBeNull()
})

// What an organiser's other tools (Splits) send them, for Import dancers to pick up.
test('your tools’ inbox is yours alone, and holds lists of dancers', async () => {
  const me = org.uid
  const at = (id: string, who = me) => `users:inbox/${who}/${id}`
  const list = (extra: Record<string, unknown> = {}) => ({ kind: 'dancers', source: 'Splits', name: 'splits.csv', text: '100,Ava,Reid,Calgary', sentAt: { '.sv': 'timestamp' }, ...extra })
  await allowed('a tool sends a list (as Splits writes it)', as(org, 'PUT', at('-In1'), list({ competitionId: pub })))
  await allowed('one without a competition', as(org, 'PUT', at('-In2'), list()))
  await allowed('read your own inbox', as(org, 'GET', `users:inbox/${me}`))
  expect(typeof (await dbGet(`${at('-In1')}/sentAt`))).toBe('number')
  await refused('someone else reading it', as(stranger, 'GET', `users:inbox/${me}`))
  await refused('someone else reading one list', as(stranger, 'GET', at('-In1')))
  await refused('signed out, read it', as(null, 'GET', `users:inbox/${me}`))
  await refused('someone else sending you a list', as(stranger, 'PUT', at('-In3'), list()))
  await refused('someone else removing one', as(stranger, 'DELETE', at('-In1')))
  await refused('a kind that isn’t dancers', as(org, 'PUT', at('-In3'), list({ kind: 'results' })))
  await refused('a list with no text', as(org, 'PUT', at('-In3'), list({ text: null })))
  await refused('text that isn’t text', as(org, 'PUT', at('-In3'), list({ text: 3 })))
  await refused('text over a megabyte', as(org, 'PUT', at('-In3'), list({ text: 'x'.repeat(1_000_001) })))
  await refused('a name that isn’t text', as(org, 'PUT', at('-In3'), list({ name: 3 })))
  await refused('no source', as(org, 'PUT', at('-In3'), list({ source: null })))
  await refused('a sent at that isn’t a time', as(org, 'PUT', at('-In3'), list({ sentAt: 'now' })))
  await refused('a competition that isn’t an id', as(org, 'PUT', at('-In3'), list({ competitionId: true })))
  await refused('anything else in a list', as(org, 'PUT', at('-In3'), list({ note: 'hi' })))
  await allowed('dismiss one (or import it)', as(org, 'PATCH', '', { [at('-In1')]: null }))
  await allowed('undo a dismiss (its old sent at)', as(org, 'PUT', at('-In1'), list({ sentAt: 1 })))
})

test('an organiser can change their competitions and nothing else', async () => {
  await allowed('a detail (writeInfo)', as(org, 'PATCH', '', { [`competitions/${pub}/name`]: 'Rules renamed' }))
  await allowed('a venue pick (several fields at once)', as(org, 'PATCH', '', { [`competitions/${pub}/venue`]: 'Rules Hall', [`competitions/${pub}/locality`]: 'Calgary', [`competitions/${pub}/lat`]: 51, [`competitions/${pub}/lng`]: -114 }))
  await allowed('unpublish', as(org, 'PATCH', '', { [`competitions/${priv}/published`]: false, [`competitions/${priv}/listed`]: false }))
  await allowed('add a dancer (whole record)', as(org, 'PATCH', '', { [`competitions:data/${pub}/dancers/d2`]: { firstName: 'Rules', lastName: 'Second', number: '2' } }))
  await allowed('delete a dancer', as(org, 'PATCH', '', { [`competitions:data/${pub}/dancers/d2`]: null }))
  await allowed('invite an admin', as(org, 'PATCH', '', { [`competitions:data/${pub}/invites/org-invite`]: { created: new Date().toISOString(), payload: { email: 'friend@example.test' } } }))
  await refused('edit someone else’s competition', as(org, 'PATCH', '', { 'competitions/-L9Sc9TQWQclq_7oA3ij/name': 'x' }))
  await refused('create a competition (system admins only)', as(org, 'PATCH', '', { [`competitions/${uid('rules-new')}`]: { name: 'x', date: '2026-10-01' } }))
  await refused('write a profile (aggregate)', as(org, 'PATCH', '', { 'dancers/-Agg/name': 'x' }))
})

test('judges’ sheets: organisers add pages whose files are in their own folder; everyone reads a published one’s', async () => {
  const at = (c: string, page = 'p1', dance = 'd1') => `competitions:data/${c}/sheets/g1/${dance}/${page}`
  const page = (c: string, extra: Record<string, unknown> = {}) => ({
    url: 'https://firebasestorage.googleapis.com/v0/b/firebase-scotdance.appspot.com/o/x',
    path: `competitions/sheets/${c}/1-a.webp`,
    width: 1500,
    height: 2000,
    _order: 1,
    ...extra,
  })
  await allowed('add a page', as(org, 'PATCH', '', { [at(pub)]: page(pub) }))
  await allowed('add one to a private competition', as(org, 'PATCH', '', { [at(priv)]: page(priv) }))
  await allowed('a parent reading a published competition’s sheets', as(parent, 'GET', `competitions:data/${pub}/sheets`))
  await allowed('reading them signed out', as(null, 'GET', `competitions:data/${pub}/sheets`))
  await refused('a parent reading a private competition’s sheets', as(parent, 'GET', `competitions:data/${priv}/sheets`))
  // Functions delete a page's file with it, so it may only name a file of its own.
  await refused('a page whose file is in another competition’s folder', as(org, 'PATCH', '', { [at(pub, 'p2')]: page(pub, { path: `competitions/sheets/${priv}/1-a.webp` }) }))
  await refused('a page whose file is anywhere else', as(org, 'PATCH', '', { [at(pub, 'p2')]: page(pub, { path: 'competitions/info/logo.png' }) }))
  await refused('a page whose file climbs out of its folder', as(org, 'PATCH', '', { [at(pub, 'p2')]: page(pub, { path: `competitions/sheets/${pub}/../${priv}/1-a.webp` }) }))
  await refused('a page without its size', as(org, 'PATCH', '', { [at(pub, 'p2')]: { url: page(pub).url, path: page(pub).path } }))
  await refused('a page with a field pages don’t have', as(org, 'PATCH', '', { [at(pub, 'p2')]: page(pub, { judge: 'A' }) }))
  await refused('a page whose picture is on someone else’s server', as(org, 'PATCH', '', { [at(pub, 'p2')]: page(pub, { url: 'https://example.com/sheet.webp' }) }))
  await refused('a dance’s sheet that isn’t pages', as(org, 'PATCH', '', { [`competitions:data/${pub}/sheets/g1/d2`]: 'x' }))
  await refused('a parent adding a page', as(parent, 'PATCH', '', { [at(pub, 'p3')]: page(pub) }))
  await allowed('delete a page', as(org, 'PATCH', '', { [at(pub)]: null }))
})

test('invites: only an organiser makes them; anyone with the link accepts an open one, once', async () => {
  const invite = (id: string) => `competitions:data/${pub}/invites/${id}`
  await dbSet(invite('real'), { created: new Date().toISOString(), payload: { email: 'parent@example.test' } })
  await allowed('the invitee reads it', as(parent, 'GET', invite('real')))
  await refused('signed out, read one (private competition)', as(null, 'GET', `competitions:data/${priv}/invites/real`))
  await refused('list a private competition’s invites', as(stranger, 'GET', `competitions:data/${priv}/invites`))
  await allowed('the invitee accepts (the app’s write)', as(parent, 'PATCH', '', { [`${invite('real')}/accepted`]: new Date().toISOString() }))
  await refused('take over an accepted invite', as(stranger, 'PATCH', '', { [`${invite('real')}/accepted`]: new Date().toISOString() }))
  await refused('change who an invite is for', as(stranger, 'PATCH', '', { [`${invite('real')}/payload/email`]: 'stranger@example.test' }))

  // The hole this closes: a stranger inviting themselves to any competition.
  const forged = `competitions:data/${priv}/invites/${uid('forged')}`
  await refused('a stranger creates an invite', as(stranger, 'PUT', forged, { created: new Date().toISOString(), payload: { email: 'stranger@example.test' } }))
  await refused('a stranger accepts an invite that doesn’t exist', as(stranger, 'PATCH', '', { [`${forged}/accepted`]: new Date().toISOString() }))

  // Someone else's invite, cancelled. (Not the parent's: the invite they
  // accepted makes them an organiser here as soon as the functions get to it,
  // and an organiser may write anything in the competition.)
  const other = await account(`${uid('rules-invitee')}@example.test`)
  try {
    await dbSet(invite('cancel'), { created: new Date().toISOString(), payload: { email: 'x@example.test' } })
    await allowed('the organiser cancels', as(org, 'PATCH', '', { [`${invite('cancel')}/cancelled`]: new Date().toISOString() }))
    await refused('accepting a cancelled invite', as(other, 'PATCH', '', { [`${invite('cancel')}/accepted`]: new Date().toISOString() }))
    await allowed('the organiser undoes the cancel', as(org, 'PATCH', '', { [`${invite('cancel')}/cancelled`]: null }))
    await allowed('accepting it again once it’s open', as(other, 'PATCH', '', { [`${invite('cancel')}/accepted`]: new Date().toISOString() }))

    // The functions turn the accepted invites into access (and only for the invitee).
    for (const who of [parent, other])
      await expect.poll(() => dbGet(`users:permissions/${who.uid}/competitions/${pub}`), { timeout: 30_000 }).toBe(true)
    expect(await dbGet(`users:permissions/${stranger.uid}/competitions/${priv}`)).toBeNull()
  } finally {
    await dbRemove(`users:permissions/${other.uid}`)
  }
})

// An assistant (the `mcp` function, ADR 0018) is signed in as its person with a token marked via: 'mcp'. It gets
// what that person was made an admin of, and a system admin's grant over everything is not part of it.
test('an assistant gets its person’s own grants, never a system admin’s, and never access or whole competitions', async () => {
  const boss = await account(`${uid('rules-boss')}@example.test`)
  const scratch = uid('rules-scratch')
  await dbSet(`users:permissions/${boss.uid}/admin`, true)
  await dbSet(`users:permissions/${boss.uid}/competitions/${scratch}`, true)
  await dbSet(`competitions/${scratch}`, { name: 'Rules scratch', date: '2026-10-01' })
  await dbSet(`users:tools/${org.uid}/binder`, { linkedAt: 1, signedInAt: 1 })
  await dbSet(`users:connections/${org.uid}/c1`, { id: 'c1', client: { id: 'x', name: 'Claude' }, scope: 'manage', createdAt: 1, lastUsedAt: 1 })
  await dbSet('oauth:tokens/hash1', { uid: org.uid, connection: 'c1', scope: 'manage', expiresAt: 1 })
  const botSubmission = uid('rules-botsub')
  const orgBot = await assistant(org)
  const bossBot = await assistant(boss)
  try {
    // The same system admin, in person and as an assistant
    await allowed('a system admin reads a private competition’s data', as(boss, 'GET', `competitions:data/${priv}`))
    await refused('their assistant reads it', as(bossBot, 'GET', `competitions:data/${priv}`))
    await refused('their assistant edits a competition they were not made an admin of', as(bossBot, 'PATCH', `competitions/${priv}`, { name: 'x' }))
    await refused('their assistant reads the whole tree', as(bossBot, 'GET', ''))
    await allowed('their assistant reads their own permissions (how it finds their competitions)', as(bossBot, 'GET', `users:permissions/${boss.uid}/competitions`))
    await allowed('their assistant reads a competition they were made an admin of', as(bossBot, 'GET', `competitions:data/${scratch}`))
    await allowed('their assistant edits it', as(bossBot, 'PATCH', `competitions/${scratch}`, { name: 'Rules scratch edited' }))
    await refused('their assistant makes itself an admin of another', as(bossBot, 'PUT', `users:permissions/${boss.uid}/competitions/${priv}`, true))
    await refused('their assistant edits the list of a competition’s admins', as(bossBot, 'PUT', `competitions:permissions/${scratch}/users/${stranger.uid}`, true))

    // An organiser's assistant: their competition, as they have it
    await allowed('read their competition’s data', as(orgBot, 'GET', `competitions:data/${pub}/dancers`))
    await allowed('edit their competition', as(orgBot, 'PATCH', '', { [`competitions/${pub}/name`]: 'Rules assistant' }))
    await allowed('add a dancer', as(orgBot, 'PATCH', '', { [`competitions:data/${pub}/dancers/d3`]: { firstName: 'Rules', lastName: 'Third', number: '3' } }))
    await allowed('and take them off again', as(orgBot, 'PUT', `competitions:data/${pub}/dancers/d3`, null))
    await allowed('change the schedule', as(orgBot, 'PUT', `competitions:data/${pub}/schedule/d1`, { name: 'Day' }))
    await refused('edit someone else’s competition', as(orgBot, 'PATCH', `competitions/${scratch}`, { name: 'x' }))
    await refused('invite someone', as(orgBot, 'PUT', `competitions:data/${pub}/invites/bot-invite`, { created: new Date().toISOString(), payload: { email: 'friend@example.test' } }))
    await refused('invite someone, in one write at the top', as(orgBot, 'PATCH', '', { [`competitions:data/${pub}/invites/bot-invite`]: { created: new Date().toISOString(), payload: { email: 'friend@example.test' } } }))
    await refused('write the whole of a competition’s data (invites and all)', as(orgBot, 'PUT', `competitions:data/${pub}`, { dancers: {} }))
    await refused('accept an invite', as(orgBot, 'PATCH', '', { [`competitions:data/${pub}/invites/real/accepted`]: new Date().toISOString() }))
    await refused('delete a whole competition', as(orgBot, 'DELETE', `competitions/${pub}`))
    await refused('delete a whole competition, in one write at the top', as(orgBot, 'PATCH', '', { [`competitions/${pub}`]: null }))
    await refused('give themselves a competition', as(orgBot, 'PUT', `users:permissions/${org.uid}/competitions/${priv}`, true))
    await refused('make themselves a system admin', as(orgBot, 'PUT', `users:permissions/${org.uid}/admin`, true))
    await refused('remove their own permission', as(orgBot, 'DELETE', `users:permissions/${org.uid}/competitions/${pub}`))
    await refused('unlink a tool', as(orgBot, 'DELETE', `users:tools/${org.uid}/binder`))
    await refused('write the assistants connected', as(orgBot, 'PUT', `users:connections/${org.uid}/c2`, { id: 'c2' }))
    await refused('read the assistants connected', as(orgBot, 'GET', `users:connections/${org.uid}`))
    await refused('read the sign-in records', as(orgBot, 'GET', 'oauth:tokens'))
    await refused('write a token', as(orgBot, 'PUT', 'oauth:tokens/forged', { uid: org.uid }))

    // Their own account is theirs, not the assistant's: it can look, not touch
    await allowed('the person writes their account record', as(org, 'PUT', `users/${org.uid}/scratch`, { at: 1 }))
    await allowed('the person favourites a dancer', as(org, 'PUT', `users:favorites/${org.uid}/dancers/d1`, true))
    await allowed('the person saves a push token', as(org, 'PUT', `users:tokens/${org.uid}/t1`, { at: 1 }))
    await allowed('the person turns a dancer’s alerts off', as(org, 'PUT', `users:alertsOff/${org.uid}/dancers/d1`, true))
    await allowed('the person picks a dancer’s colour', as(org, 'PUT', `users:dancerColors/${org.uid}/d1`, 'dancer-3'))
    await allowed('assistant reads the record', as(orgBot, 'GET', `users/${org.uid}`))
    await allowed('assistant reads the favourites', as(orgBot, 'GET', `users:favorites/${org.uid}`))
    await refused('assistant writes the account record', as(orgBot, 'PUT', `users/${org.uid}/scratch`, { at: 2 }))
    await refused('assistant writes the account record, at the top', as(orgBot, 'PATCH', '', { [`users/${org.uid}/scratch`]: { at: 2 } }))
    await refused('assistant favourites a dancer', as(orgBot, 'PUT', `users:favorites/${org.uid}/dancers/d2`, true))
    await refused('assistant saves a push token', as(orgBot, 'PUT', `users:tokens/${org.uid}/t2`, { at: 2 }))
    await refused('assistant turns alerts off', as(orgBot, 'PUT', `users:alertsOff/${org.uid}/dancers/d2`, true))
    await refused('assistant picks a colour', as(orgBot, 'PUT', `users:dancerColors/${org.uid}/d2`, 'dancer-4'))
    await refused('assistant records a profile view', as(orgBot, 'PUT', `dancers:views/${org.uid}/2026-11-11/d1`, true))
    await allowed('the person records a profile view', as(org, 'PUT', `dancers:views/${org.uid}/2026-11-11/d1`, true))
    // Left open on purpose: Import dancers previews what an assistant files here, and a competition is added by submitting it
    await allowed('assistant files a dancer list in the inbox', as(orgBot, 'PUT', `users:inbox/${org.uid}/bot-item`, { kind: 'dancers', source: 'assistant', name: 'List', text: 'a', sentAt: 1 }))
    await allowed('assistant submits a competition', as(orgBot, 'PUT', `competitions:submissions/${botSubmission}`, { competition: { name: 'Rules bot sub', date: '2027-01-01', location: 'Calgary, AB' }, contact: { email: 'p@example.test' }, submitted: new Date().toISOString() }))

    // The person themselves: the same things stay theirs
    await allowed('the person invites', as(org, 'PUT', `competitions:data/${pub}/invites/person-invite`, { created: new Date().toISOString(), payload: { email: 'friend@example.test' } }))
    await allowed('the person reads the assistants connected', as(org, 'GET', `users:connections/${org.uid}`))
    await refused('the person writes them', as(org, 'PUT', `users:connections/${org.uid}/c2`, { id: 'c2' }))
    await refused('the person reads the sign-in records', as(org, 'GET', 'oauth:tokens'))
    await refused('the person writes a token', as(org, 'PUT', 'oauth:tokens/forged', { uid: org.uid }))
    await allowed('the person deletes a competition of theirs', as(boss, 'DELETE', `competitions/${scratch}`))
  } finally {
    await dbRemove(`competitions:submissions/${botSubmission}`)
    await dbRemove(`users:inbox/${org.uid}`)
    await dbRemove(`users:tokens/${org.uid}`)
    await dbRemove(`dancers:views/${org.uid}`)
    await dbRemove(`competitions:data/${pub}/invites/person-invite`)
    await dbRemove(`competitions/${scratch}`)
    await dbRemove(`users:tools/${org.uid}`)
    await dbRemove(`users:connections/${org.uid}`)
    await dbRemove('oauth:tokens')
    await dbRemove(`users:permissions/${boss.uid}`)
    await dbRemove(`users/${boss.uid}`)
  }
})

// The assistants' change log (ADR 0018): written with the change by an assistant that manages the competition, read by
// the people who manage it, never rewritten, and only ever marked undone.
test('the change log: an assistant makes entries and marks them undone; only managers read; nobody rewrites', async () => {
  const orgBot = await assistant(org)
  const strangerBot = await assistant(stranger)
  const entry = (extra: Record<string, unknown> = {}) => ({
    at: { '.sv': 'timestamp' },
    uid: org.uid,
    tool: 'save_dancers',
    summary: 'Added Rules Fourth',
    paths: [{ path: `competitions:data/${pub}/dancers/d4/number`, after: '4' }],
    ...extra,
  })
  const base = `competitions:changes/${pub}`
  try {
    // In the same update as the change, as the tools write it
    await allowed('an assistant writes a change and its entry together', as(orgBot, 'PATCH', '', { [`competitions:data/${pub}/dancers/d4`]: { number: '4', firstName: 'Rules', lastName: 'Fourth' }, [`${base}/e1`]: entry() }))
    await refused('an assistant writes an entry for someone else', as(orgBot, 'PUT', `${base}/e2`, entry({ uid: stranger.uid })))
    await refused('an assistant writes an entry without what it changed', as(orgBot, 'PUT', `${base}/e3`, { at: { '.sv': 'timestamp' }, uid: org.uid, tool: 't', summary: 's' }))
    await refused('an assistant writes an entry with something extra', as(orgBot, 'PUT', `${base}/e4`, entry({ extra: 1 })))
    await refused('an assistant writes an entry for a competition it does not manage', as(orgBot, 'PUT', `competitions:changes/${priv}-none/e5`, entry()))
    await refused('a stranger’s assistant writes an entry', as(strangerBot, 'PUT', `${base}/e6`, entry({ uid: stranger.uid })))
    await refused('a person writes an entry directly', as(org, 'PUT', `${base}/e7`, entry()))
    await refused('an assistant rewrites an entry', as(orgBot, 'PUT', `${base}/e1`, entry({ summary: 'Something else' })))
    await refused('an assistant changes an entry’s paths', as(orgBot, 'PUT', `${base}/e1/paths`, [{ path: `competitions:data/${pub}/dancers/d1`, after: null }]))
    await refused('an assistant deletes an entry', as(orgBot, 'DELETE', `${base}/e1`))
    // Marking undone, once, by themselves, with the undo in the same update
    await refused('a mark by someone else', as(orgBot, 'PUT', `${base}/e1/undone`, { at: { '.sv': 'timestamp' }, by: stranger.uid, change: 'e8' }))
    await allowed('an assistant marks an entry undone, with the undo entry', as(orgBot, 'PATCH', '', { [`${base}/e1/undone`]: { at: { '.sv': 'timestamp' }, by: org.uid, change: 'e8' }, [`${base}/e8`]: entry({ tool: 'undo_change', undoOf: 'e1', summary: 'Undid: Added Rules Fourth' }), [`competitions:data/${pub}/dancers/d4`]: null }))
    await refused('and marks it again', as(orgBot, 'PUT', `${base}/e1/undone`, { at: { '.sv': 'timestamp' }, by: org.uid, change: 'e9' }))
    // Reading
    await allowed('a person who manages it reads the log', as(org, 'GET', base))
    await allowed('their assistant reads it', as(orgBot, 'GET', base))
    await refused('a stranger reads the log', as(stranger, 'GET', base))
    await refused('a stranger’s assistant reads the log', as(strangerBot, 'GET', base))
    await refused('a signed-out read', as(null, 'GET', base))
    await refused('a parent writes it', as(parent, 'PUT', `${base}/e10`, entry()))
  } finally {
    await dbRemove(`competitions:changes/${pub}`)
    await dbRemove(`competitions:data/${pub}/dancers/d4`)
  }
})

// The per-person index of those changes (ADR 0018): an assistant adds its person's own entries, and marks one undone once; only the
// person reads them; nobody else writes, rewrites or deletes. Deleting their account clears it.
test('the change index: an assistant adds its own person’s entries; only that person reads; a person can clear their own', async () => {
  const orgBot = await assistant(org)
  const strangerBot = await assistant(stranger)
  const base = `users:changes/${org.uid}/conn1`
  const item = (extra: Record<string, unknown> = {}) => ({ at: { '.sv': 'timestamp' }, scope: 'competitions', scopeId: pub, summary: 'Added Rules Fourth', ...extra })
  try {
    await allowed('an assistant adds an entry', as(orgBot, 'PUT', `${base}/i1`, item()))
    await allowed('for an organisation', as(orgBot, 'PUT', `${base}/i2`, item({ scope: 'organisations', scopeId: 'o1' })))
    await allowed('with an undo', as(orgBot, 'PUT', `${base}/i3`, item({ undoOf: 'i1', summary: 'Undid: Added Rules Fourth' })))
    await refused('an entry for another person', as(orgBot, 'PUT', `users:changes/${stranger.uid}/conn1/i4`, item()))
    await refused('a stranger’s assistant writes into this person’s', as(strangerBot, 'PUT', `${base}/i5`, item()))
    await refused('a person writes an entry directly', as(org, 'PUT', `${base}/i6`, item()))
    await refused('an entry without what it needs', as(orgBot, 'PUT', `${base}/i7`, { at: { '.sv': 'timestamp' }, summary: 's' }))
    await refused('an entry for something that is not a competition or organisation', as(orgBot, 'PUT', `${base}/i8`, item({ scope: 'users' })))
    await refused('an entry with something extra', as(orgBot, 'PUT', `${base}/i9`, item({ extra: 1 })))
    await refused('rewrites an entry', as(orgBot, 'PUT', `${base}/i1`, item({ summary: 'Something else' })))
    await refused('deletes an entry', as(orgBot, 'DELETE', `${base}/i1`))
    await allowed('marks its own undone', as(orgBot, 'PUT', `${base}/i1/undone`, { '.sv': 'timestamp' }))
    await refused('and marks it again', as(orgBot, 'PUT', `${base}/i1/undone`, { '.sv': 'timestamp' }))
    await refused('marks one that is not there', as(orgBot, 'PUT', `${base}/i99/undone`, { '.sv': 'timestamp' }))
    await refused('a stranger’s assistant marks it', as(strangerBot, 'PUT', `${base}/i2/undone`, { '.sv': 'timestamp' }))
    await allowed('the person reads their entries', as(org, 'GET', base))
    await allowed('their assistant reads its own person’s (it checks an entry is there before marking it undone)', as(orgBot, 'GET', `${base}/i1`))
    await refused('a stranger’s assistant reads it', as(strangerBot, 'GET', base))
    await refused('a stranger reads it', as(stranger, 'GET', base))
    await refused('a signed-out read', as(null, 'GET', base))
    await refused('an assistant clears the index', as(orgBot, 'DELETE', `users:changes/${org.uid}`))
    await allowed('the person clears their own (deleting their account)', as(org, 'DELETE', `users:changes/${org.uid}`))
  } finally {
    await dbRemove(`users:changes/${org.uid}`)
  }
})

// Organisations (ADR 0018): an assistant edits an organisation its person is an admin of, and puts it on competitions, through
// the same rules as the Manage page; its change log is the organisation's, written with the change by that assistant only.
test('an organisation’s assistant: the page and its competitions, a change log of its own, never its admins', async () => {
  const oid = uid('rules-org')
  const other = uid('rules-org-other')
  const orgBot = await assistant(org)
  const strangerBot = await assistant(stranger)
  const base = `organisations:changes/${oid}`
  const entry = (extra: Record<string, unknown> = {}) => ({
    at: { '.sv': 'timestamp' },
    uid: org.uid,
    tool: 'update_organisation',
    summary: 'Changed location',
    paths: [{ path: `organisations/${oid}/location`, before: 'A', after: 'B' }],
    ...extra,
  })
  await dbSet(`organisations/${oid}`, { name: 'Rules Society', location: 'A' })
  await dbSet(`organisations/${other}`, { name: 'Someone Else' })
  await dbSet(`users:permissions/${org.uid}/organisations/${oid}`, true)
  await dbSet(`organisations:permissions/${oid}/users/${org.uid}`, true)
  try {
    await allowed('their assistant edits the organisation’s page, with the log entry in one write', as(orgBot, 'PATCH', '', { [`organisations/${oid}/location`]: 'B', [`${base}/e1`]: entry() }))
    await allowed('puts it on a competition it does not manage', as(orgBot, 'PATCH', '', { [`competitions/${priv}/organisations/${oid}`]: true }))
    await allowed('and takes it off again', as(orgBot, 'PATCH', '', { [`competitions/${priv}/organisations/${oid}`]: null }))
    await refused('edits another organisation', as(orgBot, 'PATCH', `organisations/${other}`, { name: 'Mine now' }))
    await refused('puts another organisation on a competition', as(orgBot, 'PUT', `competitions/${priv}/organisations/${other}`, true))
    await refused('deletes the organisation', as(orgBot, 'DELETE', `organisations/${oid}`))
    await refused('invites an admin', as(orgBot, 'PUT', `organisations:data/${oid}/invites/bot`, { created: new Date().toISOString(), payload: { email: 'friend@example.test' } }))
    await refused('makes someone an admin', as(orgBot, 'PUT', `organisations:permissions/${oid}/users/${stranger.uid}`, true))
    await refused('makes itself an admin of another', as(orgBot, 'PUT', `users:permissions/${org.uid}/organisations/${other}`, true))
    await refused('a stranger’s assistant edits it', as(strangerBot, 'PATCH', `organisations/${oid}`, { location: 'Z' }))

    // The log
    await refused('an assistant writes an entry for someone else', as(orgBot, 'PUT', `${base}/e2`, entry({ uid: stranger.uid })))
    await refused('an entry without what it changed', as(orgBot, 'PUT', `${base}/e3`, { at: { '.sv': 'timestamp' }, uid: org.uid, tool: 't', summary: 's' }))
    await refused('an entry with something extra', as(orgBot, 'PUT', `${base}/e4`, entry({ extra: 1 })))
    await refused('an entry for another organisation', as(orgBot, 'PUT', `organisations:changes/${other}/e5`, entry()))
    await refused('a stranger’s assistant writes one', as(strangerBot, 'PUT', `${base}/e6`, entry({ uid: stranger.uid })))
    await refused('a person writes one directly', as(org, 'PUT', `${base}/e7`, entry()))
    await refused('rewrites one', as(orgBot, 'PUT', `${base}/e1`, entry({ summary: 'Something else' })))
    await refused('deletes one', as(orgBot, 'DELETE', `${base}/e1`))
    await refused('a mark by someone else', as(orgBot, 'PUT', `${base}/e1/undone`, { at: { '.sv': 'timestamp' }, by: stranger.uid, change: 'e8' }))
    await allowed('marks one undone, with the undo entry', as(orgBot, 'PATCH', '', { [`${base}/e1/undone`]: { at: { '.sv': 'timestamp' }, by: org.uid, change: 'e8' }, [`${base}/e8`]: entry({ tool: 'undo_change', undoOf: 'e1', summary: 'Undid: Changed location' }), [`organisations/${oid}/location`]: 'A' }))
    await refused('and marks it again', as(orgBot, 'PUT', `${base}/e1/undone`, { at: { '.sv': 'timestamp' }, by: org.uid, change: 'e9' }))
    await allowed('its admin reads the log', as(org, 'GET', base))
    await allowed('their assistant reads it', as(orgBot, 'GET', base))
    await refused('a stranger reads it', as(stranger, 'GET', base))
    await refused('a stranger’s assistant reads it', as(strangerBot, 'GET', base))
    await refused('a signed-out read', as(null, 'GET', base))
  } finally {
    await dbRemove(base)
    await dbRemove(`organisations/${oid}`)
    await dbRemove(`organisations/${other}`)
    await dbRemove(`organisations:permissions/${oid}`)
    await dbRemove(`users:permissions/${org.uid}/organisations`)
    await dbRemove(`competitions/${priv}/organisations`)
  }
})

test('known competitions: read when signed in, written only by functions, and how their reads went for system admins only', async () => {
  const key = `sdc:2027-10-23:${uid('rules-known')}`
  await dbSet(`knownCompetitions/${key}`, { source: 'sdc', date: '2027-10-23', name: 'Rules Fall Classic', country: 'CA', fetched: '2026-10-12T07:00:00.000Z' })
  try {
    await refused('a signed-out read of known competitions', as(null, 'GET', 'knownCompetitions'))
    await allowed('a parent reading known competitions', as(parent, 'GET', 'knownCompetitions'))
    await allowed('an organiser reading one known competition', as(org, 'GET', `knownCompetitions/${key}`))
    await refused('an organiser changing a known competition', as(org, 'PATCH', `knownCompetitions/${key}`, { name: 'Mine now' }))
    await refused('an organiser adding a known competition', as(org, 'PUT', `knownCompetitions/sdc:2027-10-24:x`, { source: 'sdc', date: '2027-10-24', name: 'X', country: 'CA' }))
    await refused('an organiser reading how the reads went', as(org, 'GET', 'knownCompetitions:runs'))
    await refused('an organiser saying how a read went', as(org, 'PUT', 'knownCompetitions:runs/sdc', { at: 'now' }))
  } finally {
    await dbRemove(`knownCompetitions/${key}`)
  }
})

// Hidden profiles are read one at a time; view counts are written by the account itself and read by system admins only.
test('hidden profiles are read one at a time, and profile views are written by you, once a dancer a day, and never read back', async () => {
  await dbSet('dancers:hidden/-RulesHide', { by: 'someone', byName: 'Rules Admin', at: 1, note: 'Her mum asked' })
  await allowed('signed-out read of one hidden profile', as(null, 'GET', 'dancers:hidden/-RulesHide'))
  await refused('signed-out read of every hidden profile', as(null, 'GET', 'dancers:hidden'))
  await refused('a parent hiding a profile', as(parent, 'PUT', 'dancers:hidden/-RulesOther', { by: parent.uid, byName: 'Me', at: 1 }))
  await refused('a parent showing a hidden profile again', as(parent, 'DELETE', 'dancers:hidden/-RulesHide'))

  const day = new Date().toISOString().slice(0, 10)
  const view = (dancerId: string, who = parent.uid, d = day) => `dancers:views/${who}/${d}/${dancerId}`
  await allowed('open a profile', as(parent, 'PUT', view('-Agg1'), true))
  await allowed('open it again', as(parent, 'PUT', view('-Agg1'), true))
  expect(await dbGet(view('-Agg1'))).toBe(true)
  await refused('someone else’s views', as(parent, 'PUT', view('-Agg1', org.uid), true))
  await refused('signed out', as(null, 'PUT', view('-Agg1'), true))
  await refused('a view that isn’t true', as(parent, 'PUT', view('-Agg2'), 'yes'))
  await refused('a view that is false', as(parent, 'PUT', view('-Agg2'), false))
  await refused('a day that isn’t a day', as(parent, 'PUT', view('-Agg2', parent.uid, 'today'), true))
  await refused('reading your own views back', as(parent, 'GET', `dancers:views/${parent.uid}`))
  await refused('reading everyone’s views', as(parent, 'GET', 'dancers:views'))
  await refused('flagging yourself', as(parent, 'PUT', `dancers:viewFlags/${parent.uid}/${day}`, { count: 1 }))
  await refused('reading the flags', as(parent, 'GET', 'dancers:viewFlags'))
})

test('deleting an account can wipe its data in one write', async () => {
  const who = await account(`${uid('rules-leaver')}@example.test`)
  await as(who, 'PUT', `users:favorites/${who.uid}/dancers/-Agg1`, 'X')
  await as(who, 'PUT', `users:dancerColors/${who.uid}/-Agg1`, 'dancer-2')
  await as(who, 'PUT', `users:alertsOff/${who.uid}/dancers/-Agg1`, true)
  await as(who, 'PUT', `users:inbox/${who.uid}/-In1`, { kind: 'dancers', source: 'Splits', name: 'a.csv', text: '1,A,B', sentAt: 1 })
  await dbSet(`users:permissions/${who.uid}/competitions/${pub}`, true)
  await allowed(
    'the deleteAccount multi-path wipe',
    as(who, 'PATCH', '', {
      [`users/${who.uid}`]: null,
      [`users:favorites/${who.uid}`]: null,
      [`users:alertsOff/${who.uid}`]: null,
      [`users:dancerColors/${who.uid}`]: null,
      [`users:inbox/${who.uid}`]: null,
      [`users:permissions/${who.uid}`]: null,
    }),
  )
  expect(await dbGet(`users:dancerColors/${who.uid}`)).toBeNull()
  expect(await dbGet(`users:inbox/${who.uid}`)).toBeNull()
  expect(await dbGet(`users:alertsOff/${who.uid}`)).toBeNull()
})
