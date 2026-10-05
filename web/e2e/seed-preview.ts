// Fills a local emulator stack with made-up organisations and competitions,
// for trying organisations and alerts by hand. Never point it at anything
// but the emulators: it writes as the emulator's "owner".
//
//   E2E_EMULATOR_PORT_OFFSET=4 npx jiti e2e/seed-preview.ts
//
// Accounts (password "password"): preview-admin@scotdance.test (system
// admin), preview-organiser@scotdance.test (runs FHDA and the Prairie
// Championship Series) and preview-parent@scotdance.test (follows a dancer
// at today's competition, with alerts on).
import { dbGet, dbSet, dbUpdate, ensureUser, grantCompetition, grantSystemAdmin } from './support/emulator'
import { isoDay, seedCompetition } from './support/seed'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// A simple made-up logo: an emblem on a clear background, as most real
// logos are drawn, as an SVG data URL.
const logo = (ink: string, tint: string, letters: string, shape: 'peak' | 'wave' | 'ring' | 'shield') => {
  const art = {
    peak: `<circle cx="50" cy="50" r="46" fill="${tint}"/><path d="M14 70 L38 34 L52 52 L64 40 L86 70 Z" fill="${ink}"/><path d="M38 34 L44 43 L32 43 Z" fill="#fff"/>`,
    wave: `<circle cx="50" cy="50" r="46" fill="${ink}"/><path d="M8 58 Q22 46 36 58 T64 58 T92 56 V70 Q50 96 8 70 Z" fill="${tint}"/>`,
    ring: `<circle cx="50" cy="50" r="42" fill="none" stroke="${ink}" stroke-width="8"/><circle cx="50" cy="50" r="30" fill="${tint}"/>`,
    shield: `<path d="M50 6 L88 20 V48 Q88 78 50 96 Q12 78 12 48 V20 Z" fill="${ink}"/>`,
  }[shape]
  const y = { peak: 88, wave: 47, ring: 57, shield: 60 }[shape]
  const fill = { peak: ink, wave: '#fff', ring: ink, shield: '#fff' }[shape]
  const text = shape === 'peak' ? '' : `<text x="50" y="${y}" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="${letters.length > 3 ? 18 : 21}" text-anchor="middle" fill="${fill}">${letters}</text>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">${art}${text}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const ORGS = {
  fhda: {
    name: 'Foothills Highland Dancing Association',
    shortName: 'FHDA',
    location: 'Calgary, AB',
    website: 'foothillsdance.example',
    image: logo('#1f5135', '#d7ecd9', 'FHDA', 'peak'),
    description: 'Volunteers running highland dancing competitions in southern Alberta since 1978, from the Spring Competition to the Fall Classic.\n\nNew to competing? Our entry forms and rules are below.',
    links: { l1: { name: 'Entry form', url: 'https://foothillsdance.example/entry', _order: 0 }, l2: { name: 'Competition rules', url: 'https://foothillsdance.example/rules.pdf', _order: 1 } },
  },
  pcs: {
    name: 'Prairie Championship Series',
    shortName: 'PCS',
    location: 'Alberta, Saskatchewan and Manitoba',
    website: 'prairieseries.example',
    image: logo('#8a2c0d', '#fbe3c6', 'PCS', 'ring'),
    description: 'Points from five prairie competitions decide the season’s champions, crowned at the Series Final in November.',
  },
  chds: {
    name: 'Cascadia Highland Dance Society',
    shortName: 'CHDS',
    location: 'Vancouver, BC',
    image: logo('#123f6b', '#8cc7ec', 'CHDS', 'wave'),
    description: 'Indoor championships on the coast every November.',
  },
  bvhg: { name: 'Bow Valley Highland Games Society', location: 'Canmore, AB' },
  ovhd: { name: 'Ottawa Valley Highland Dancers', shortName: 'OVHD', location: 'Ottawa, ON', image: logo('#4b1d5e', '#e7d3f0', 'OVHD', 'shield') },
  mhdc: { name: 'Maritime Highland Dance Council', shortName: 'MHDC', location: 'Halifax, NS' },
}

type Seed = { name: string; date: string; venue: string; location: string; lat: number; lng: number; orgs?: string[]; listed?: boolean; published?: boolean }
const CALGARY = { venue: 'Telus Convention Centre', location: 'Calgary, AB', lat: 51.0447, lng: -114.0596 }
const CANMORE = { venue: 'Centennial Park', location: 'Canmore, AB', lat: 51.089, lng: -115.358 }
const COMPETITIONS: Record<string, Seed> = {
  'fsc-2024': { name: 'Foothills Spring Competition 2024', date: '2024-04-20', ...CALGARY },
  'fsc-2025': { name: 'Foothills Spring Competition 2025', date: '2025-04-19', ...CALGARY, orgs: ['fhda'] },
  'fsc-2026': { name: 'Foothills Spring Competition 2026', date: '2026-04-18', ...CALGARY, orgs: ['fhda'] },
  'ffc-2025': { name: 'Foothills Fall Classic 2025', date: '2025-10-04', ...CALGARY, orgs: ['fhda', 'pcs'] },
  'fnov-2026': { name: 'FHDA Novice Showcase', date: '2026-03-07', ...CALGARY },
  'bvhg-2023': { name: 'Bow Valley Highland Games 2023', date: '2023-08-05', ...CANMORE },
  'bvhg-2024': { name: 'The 46th Annual Bow Valley Highland Games', date: '2024-08-03', ...CANMORE },
  'bvhg-2025': { name: 'Bow Valley Highland Games 2025', date: '2025-08-02', ...CANMORE },
  'bvhg-2026': { name: 'Bow Valley Highland Games 2026', date: '2026-08-01', ...CANMORE, orgs: ['bvhg'] },
  'cic-2025': { name: 'Cascadia Indoor Championships 2025', date: '2025-11-15', venue: 'Croatian Cultural Centre', location: 'Vancouver, BC', lat: 49.2617, lng: -123.0697, orgs: ['chds'] },
  'cic-2026': { name: 'Cascadia Indoor Championships 2026', date: isoDay(42), venue: 'Croatian Cultural Centre', location: 'Vancouver, BC', lat: 49.2617, lng: -123.0697, orgs: ['chds'], published: false },
  'shdf-2026': { name: 'Saskatoon Highland Dance Festival', date: '2026-05-23', venue: 'TCU Place', location: 'Saskatoon, SK', lat: 52.1279, lng: -106.6627, orgs: ['pcs'] },
  'wcc-2026': { name: 'Winnipeg Celtic Classic', date: '2026-06-13', venue: 'RBC Convention Centre', location: 'Winnipeg, MB', lat: 49.8925, lng: -97.1414, orgs: ['pcs'] },
  'pcsf-2026': { name: 'Prairie Championship Series Final 2026', date: isoDay(49), venue: 'Shaw Centre', location: 'Edmonton, AB', lat: 53.5444, lng: -113.4909, orgs: ['pcs'], published: false },
  'ovo-2026': { name: 'Ottawa Valley Open', date: isoDay(21), venue: 'Nepean Sportsplex', location: 'Ottawa, ON', lat: 45.3349, lng: -75.7395, orgs: ['ovhd'], published: false },
  'mhc-2026': { name: 'Maritime Highland Championships 2026', date: '2026-07-11', venue: 'Halifax Forum', location: 'Halifax, NS', lat: 44.6588, lng: -63.6037 },
  'mhc-2025': { name: 'Maritime Highland Championships 2025', date: '2025-07-12', venue: 'Halifax Forum', location: 'Halifax, NS', lat: 44.6588, lng: -63.6037 },
  'cwi-2026': { name: 'Calgary Winter Invitational', date: '2026-01-17', ...CALGARY },
  'ehg-2026': { name: 'Edmonton Highland Games', date: '2026-07-18', venue: 'Hawrelak Park', location: 'Edmonton, AB', lat: 53.5272, lng: -113.5513 },
}
const TODAY = 'ffc-2026'

// Calls the sendMorningSummary function as the preview admin.
async function morningSummary(competitionId: string) {
  const offset = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
  const signIn = await fetch(`http://127.0.0.1:${9099 + offset}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'preview-admin@scotdance.test', password: 'password', returnSecureToken: true }),
  }).then((r) => r.json() as Promise<{ idToken: string }>)
  const res = await fetch(`http://127.0.0.1:${5001 + offset}/firebase-scotdance/us-central1/sendMorningSummary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signIn.idToken}` },
    body: JSON.stringify({ data: { competitionId } }),
  })
  console.log('Morning summary:', await res.text())
}

async function main() {
  console.log('Accounts…')
  const admin = await ensureUser('preview-admin@scotdance.test')
  const organiser = await ensureUser('preview-organiser@scotdance.test')
  const parent = await ensureUser('preview-parent@scotdance.test')
  await grantSystemAdmin(admin)
  await dbUpdate(`users/${admin}`, { displayName: 'Murray Rowan', email: 'preview-admin@scotdance.test' })
  await dbUpdate(`users/${organiser}`, { displayName: 'Fiona MacLeod', email: 'preview-organiser@scotdance.test', roles: { organizer: true } })
  await dbUpdate(`users/${parent}`, { displayName: 'Jen Campbell', email: 'preview-parent@scotdance.test', roles: { parent: true } })

  console.log('Organisations…')
  for (const [id, org] of Object.entries(ORGS)) {
    await dbSet(`organisations/${id}`, { ...org, created: '2026-09-01T12:00:00.000Z', createdBy: id === 'fhda' || id === 'pcs' ? organiser : admin })
  }
  for (const id of ['fhda', 'pcs']) {
    await dbSet(`users:permissions/${organiser}/organisations/${id}`, true)
    await dbSet(`organisations:permissions/${id}/users/${organiser}`, true)
  }

  console.log('Competitions…')
  for (const [id, c] of Object.entries(COMPETITIONS)) {
    const { orgs, listed = true, published = true, ...rest } = c
    await dbSet(`competitions/${id}`, {
      ...rest,
      country: 'CA',
      listed,
      published,
      ...(orgs && { organisations: Object.fromEntries(orgs.map((o) => [o, true])) }),
    })
  }
  for (const id of ['fsc-2026', 'ffc-2025', 'fnov-2026']) await grantCompetition(organiser, id)

  console.log('Today’s competition…')
  const today = await seedCompetition({ id: TODAY, name: 'Foothills Fall Classic 2026', published: false, resultsForGroups: 0, dancersPerGroup: 6 })
  await dbUpdate(`competitions/${TODAY}`, { venue: CALGARY.venue, location: CALGARY.location, lat: CALGARY.lat, lng: CALGARY.lng, organisations: { fhda: true, pcs: true } })
  await grantCompetition(organiser, TODAY)

  // The parent follows the competition, then it's published: the dancers
  // link to their profiles and the "is live" alert goes out.
  await dbSet(`users/${parent}/alerts`, { enabled: true })
  await dbSet(`users:tokens/${parent}/preview-iphone`, { token: 'preview-fcm-token', platform: 'ios', updatedAt: Date.now() })
  await dbSet(`users:favorites/${parent}/competitions/${TODAY}`, true)
  await wait(1500)
  await dbUpdate(`competitions/${TODAY}`, { published: true })

  // Follow one dancer, by the profile the publish made.
  const dancer = today.dancers.find((d) => d.groupId === today.groups[2].id)!
  const name = `${dancer.firstName} ${dancer.lastName}`
  let profileId: string | null = null
  for (let i = 0; i < 60 && !profileId; i++) {
    await wait(1000)
    profileId = (await dbGet<{ dancerId?: string } | null>(`competitions:data/${TODAY}/dancers/${dancer.id}`))?.dancerId ?? null
  }
  if (!profileId) throw new Error(`${name} wasn't linked to a profile: are the functions running?`)
  await dbSet(`users:favorites/${parent}/dancers/${profileId}`, name)
  await dbSet(`users:dancerColors/${parent}/${profileId}`, '#c2185b')
  console.log(`Following ${name} (${profileId})`)

  // Results: they place 2nd in the Fling; the Sword is posted without them.
  await wait(2000)
  const group = today.groups[2]
  const others = today.dancers.filter((d) => d.groupId === group.id && d.id !== dancer.id).map((d) => d.id)
  await dbSet(`competitions:data/${TODAY}/results/${group.id}/${today.dances[0].id}`, [others[0], dancer.id, others[1], others[2]])
  await dbSet(`competitions:data/${TODAY}/results/${group.id}/${today.dances[1].id}`, [others[1], others[0], others[3]])
  // The parent follows FHDA too.
  await dbSet(`users:favorites/${parent}/organisations/fhda`, ORGS.fhda.name)

  // A submission waiting for approval: under FHDA, and a new organisation.
  const sub = 'preview-submission'
  await dbSet(`competitions:submissions/${sub}`, {
    competition: { name: 'Foothills Spring Competition 2027', date: '2027-04-17', venue: CALGARY.venue, location: CALGARY.location },
    contact: { name: 'Fiona MacLeod', email: 'preview-organiser@scotdance.test', disclaimer: true },
    organisations: { fhda: true },
    newOrganisations: { n1: { name: 'Calgary Highland Games Society', shortName: 'CHGS' } },
    submitted: new Date().toISOString(),
  })
  // The server notes who sent it (here, the emulator's owner): make it Fiona.
  for (let i = 0; i < 30 && !(await dbGet(`competitions:submissions/${sub}/submittedBy`)); i++) await wait(500)
  await dbUpdate(`competitions:submissions/${sub}`, { submittedBy: organiser })

  // This morning's summary, as the hourly job would send it at 06:00.
  await wait(8000)
  await morningSummary(TODAY)
  console.log('Done. Alerts land in notifications:log after a few seconds.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
