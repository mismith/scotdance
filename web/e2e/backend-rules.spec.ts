import { expect, test } from '@playwright/test'
import { dbGet, dbRemove, dbSet, uid } from './support/emulator'
import { account, as, type Account } from './support/backend'

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
    await dbRemove(`users:dancerColors/${who.uid}`)
  }
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
  for (const node of ['dancers:index/x', 'judges/-x', 'pipers:index', 'venues/-x']) await allowed(`signed-out read of /${node}`, as(null, 'GET', node))
  // Profiles (and the dancers' name index) are read one at a time; the whole trees are too big to hand out.
  for (const node of ['dancers', 'dancers:index', 'judges', 'pipers', 'venues']) await refused(`signed-out read of all /${node}`, as(null, 'GET', node))
  // Ids kept for people who aren't showing (e.g. in a competition that was unpublished) stay private.
  await refused('signed-out read of /dancers:retired', as(null, 'GET', 'dancers:retired'))
  await refused('a parent reading /dancers:retired', as(parent, 'GET', 'dancers:retired'))
  await refused('signed-out read of a user', as(null, 'GET', `users/${parent.uid}`))
  await refused('reading someone else’s follows', as(parent, 'GET', `users:favorites/${org.uid}`))
  await refused('reading someone else’s dancer colours', as(parent, 'GET', `users:dancerColors/${org.uid}`))
  await refused('a parent reading a competition’s admins', as(parent, 'GET', `competitions:permissions/${pub}`))
  await allowed('an organiser reading their competition’s admins', as(org, 'GET', `competitions:permissions/${pub}`))
  await allowed('an organiser reading their private competition', as(org, 'GET', `competitions:data/${priv}`))
})

test('a parent can save their own things and nothing else', async () => {
  const me = parent.uid
  await allowed('roles (useRoles)', as(parent, 'PATCH', `users/${me}`, { roles: { parent: true }, rolesAnsweredAt: Date.now() }))
  await allowed('display name', as(parent, 'PATCH', `users/${me}`, { displayName: 'Rules Parent' }))
  await allowed('follow a dancer (name as the value)', as(parent, 'PUT', `users:favorites/${me}/dancers/-Agg1`, 'Rules Dancer'))
  await allowed('favourite a competition', as(parent, 'PUT', `users:favorites/${me}/competitions/${pub}`, true))
  await allowed('the follows migration (one multi-path write)', as(parent, 'PATCH', `users:favorites/${me}`, { 'dancers/-Agg2': 'Rules Dancer', 'dancers/-Agg1': null }))
  await allowed('choose a dancer colour', as(parent, 'PUT', `users:dancerColors/${me}/-Agg2`, 'dancer-3'))
  await allowed('clear a dancer colour', as(parent, 'PUT', `users:dancerColors/${me}/-Agg2`, null))
  await refused('a colour that isn’t a short string', as(parent, 'PUT', `users:dancerColors/${me}/-Agg2`, 'x'.repeat(17)))
  await refused('a colour that isn’t a string', as(parent, 'PUT', `users:dancerColors/${me}/-Agg2`, 3))
  await refused('someone else’s colours', as(parent, 'PUT', `users:dancerColors/${org.uid}/-Agg2`, 'dancer-1'))
  await refused('someone else’s follows', as(parent, 'PUT', `users:favorites/${org.uid}/dancers/x`, true))
  const submission = uid('rules-sub')
  await allowed('submit a competition', as(parent, 'PUT', `competitions:submissions/${submission}`, { competition: { name: 'Rules sub', date: '2026-11-01' }, contact: { email: 'p@example.test' }, submitted: new Date().toISOString() }))
  await refused('edit a submission once sent', as(parent, 'PATCH', `competitions:submissions/${submission}/competition`, { name: 'changed' }))
  await refused('submit one already approved', as(parent, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { competition: { name: 'x' }, approved: new Date().toISOString() }))
  await refused('signed out, submit', as(null, 'PUT', `competitions:submissions/${uid('rules-sub')}`, { competition: { name: 'x' } }))
  await refused('grant themselves a competition', as(parent, 'PUT', `users:permissions/${me}/competitions/${pub}`, true))
  await refused('make themselves a system admin', as(parent, 'PUT', `users:permissions/${me}/admin`, true))
  await refused('edit a competition', as(parent, 'PATCH', `competitions/${pub}`, { name: 'x' }))
  await refused('edit a competition’s dancers', as(parent, 'PATCH', `competitions:data/${pub}/dancers/d1`, { firstName: 'x' }))
  await refused('write a profile (aggregate)', as(parent, 'PATCH', 'dancers/-Agg', { name: 'x' }))
  await refused('publish a competition', as(parent, 'PUT', `competitions:published/${priv}`, true))
  await dbRemove(`competitions:submissions/${submission}`)
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

  await dbSet(invite('cancel'), { created: new Date().toISOString(), payload: { email: 'x@example.test' } })
  await allowed('the organiser cancels', as(org, 'PATCH', '', { [`${invite('cancel')}/cancelled`]: new Date().toISOString() }))
  await refused('accepting a cancelled invite', as(parent, 'PATCH', '', { [`${invite('cancel')}/accepted`]: new Date().toISOString() }))
  await allowed('the organiser undoes the cancel', as(org, 'PATCH', '', { [`${invite('cancel')}/cancelled`]: null }))
  await allowed('accepting it again once it’s open', as(parent, 'PATCH', '', { [`${invite('cancel')}/accepted`]: new Date().toISOString() }))

  // The functions turn the accepted invite into access (and only for the invitee).
  await expect.poll(() => dbGet(`users:permissions/${parent.uid}/competitions/${pub}`), { timeout: 30_000 }).toBe(true)
  expect(await dbGet(`users:permissions/${stranger.uid}/competitions/${priv}`)).toBeNull()
})

test('deleting an account can wipe its data in one write', async () => {
  const who = await account(`${uid('rules-leaver')}@example.test`)
  await as(who, 'PUT', `users:favorites/${who.uid}/dancers/-Agg1`, 'X')
  await as(who, 'PUT', `users:dancerColors/${who.uid}/-Agg1`, 'dancer-2')
  await dbSet(`users:permissions/${who.uid}/competitions/${pub}`, true)
  await allowed(
    'the deleteAccount multi-path wipe',
    as(who, 'PATCH', '', { [`users/${who.uid}`]: null, [`users:favorites/${who.uid}`]: null, [`users:dancerColors/${who.uid}`]: null, [`users:permissions/${who.uid}`]: null }),
  )
  expect(await dbGet(`users:dancerColors/${who.uid}`)).toBeNull()
})
