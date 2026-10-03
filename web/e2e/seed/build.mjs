// Builds the database CI starts from (database.json.gz, beside this) out of
// a local emulator export: the old app's competitions, their odd shapes and
// the profiles built from them, which the @seed tests read. The repo is
// public and the export holds real people, so every person is renamed (the
// same person to the same made-up name everywhere, so profiles and search
// still join up), and whatever else is theirs goes: accounts, bios, photos,
// websites, invites, submissions and organisers' free text. Competitions,
// dates and venues (public events and places) stay.
//
//   node web/e2e/seed/build.mjs [export dir, default .firebase/emulator-data]
//
// It refuses to write if any original full name is left anywhere.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const from = resolve(root, process.argv[2] ?? '.firebase/emulator-data')
const NS = 'development'
const data = JSON.parse(readFileSync(join(from, 'database_export/scotdance.json'), 'utf8'))[NS]

// As functions/src/utility/normalize.ts: the key profiles are found by.
const normalizeName = (name) =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
const hasLetters = (s) => /\p{L}/u.test(String(s ?? ''))

// Only what the tests read; everything about accounts goes.
const KEEP = [
  'competitions', 'competitions:data', 'competitions:published', 'competitions:listed',
  'dancers', 'dancers:index', 'dancers:retired',
  'judges', 'judges:index', 'judges:retired',
  'pipers', 'pipers:index', 'pipers:retired',
  'venues', 'venues:index', 'venues:retired',
  'series', 'faqs', 'featureFlags', 'versions', 'organizations',
]
const PEOPLE = ['dancers', 'judges', 'pipers']

// --- Everyone's identity, first, so made-up names never land on a real one.
const originals = new Set()
const addName = (name) => hasLetters(name) && originals.add(normalizeName(name))
const fullName = (r) => [r?.firstName, r?.lastName].filter((s) => s != null && s !== '').join(' ')
for (const c of Object.values(data['competitions:data'] ?? {})) {
  for (const r of Object.values(c.dancers ?? {})) addName(fullName(r))
  for (const r of Object.values(c.staff ?? {})) addName(fullName(r))
}
// Sponsors named outright (older competitions) are renamed too, but some are
// organisations whose names rightly turn up elsewhere (a series, say), so
// they aren't searched for afterwards.
const sponsors = new Set()
for (const c of Object.values(data['competitions:data'] ?? {}))
  for (const g of Object.values(c.groups ?? {}))
    if (typeof g?.sponsor === 'string' && !c.staff?.[g.sponsor] && hasLetters(g.sponsor)) sponsors.add(normalizeName(g.sponsor))
for (const ns of PEOPLE) {
  for (const a of Object.values(data[ns] ?? {})) {
    addName(a.name)
    for (const ap of Object.values(a.appearances ?? {})) addName(fullName(ap))
  }
  for (const k of Object.keys(data[`${ns}:index`] ?? {})) addName(k)
  for (const k of Object.keys(data[`${ns}:retired`] ?? {})) addName(k)
}

// Surnames none of support/seed.ts's dancers have, so a test's own dancer
// never joins one of these people's profiles.
const FIRST = ['Isla', 'Ava', 'Olivia', 'Emily', 'Sophie', 'Grace', 'Mia', 'Ella', 'Lucy', 'Freya', 'Hannah', 'Ruby', 'Chloe', 'Amelia', 'Lily', 'Eilidh', 'Morag', 'Kirsty', 'Callum', 'Fraser', 'Ailsa', 'Bonnie', 'Catriona', 'Daisy', 'Elspeth', 'Fiona', 'Georgia', 'Heather', 'Iona', 'Jessie', 'Kenna', 'Lorna', 'Maisie', 'Nora', 'Orla', 'Poppy', 'Rhona', 'Skye', 'Tilly', 'Una', 'Vaila', 'Willow', 'Zara', 'Alba', 'Brodie', 'Cara', 'Darcy', 'Erin', 'Flora', 'Gemma', 'Holly', 'Imogen', 'Jenna', 'Keira', 'Leah', 'Mhairi', 'Niamh', 'Paige', 'Robyn', 'Sorcha', 'Tara', 'Esme', 'Rowan', 'Ewan', 'Finlay', 'Hamish', 'Angus', 'Lachlan', 'Rory', 'Struan']
const LAST = ['Abernethy', 'Ainslie', 'Baird', 'Balfour', 'Buchan', 'Cairns', 'Calder', 'Carmichael', 'Chisholm', 'Crombie', 'Dalgleish', 'Dewar', 'Drummond', 'Dunlop', 'Elphinstone', 'Erskine', 'Fairbairn', 'Farquhar', 'Forsyth', 'Fyfe', 'Galbraith', 'Geddes', 'Gilchrist', 'Haldane', 'Halkett', 'Inglis', 'Imrie', 'Jardine', 'Keir', 'Kinnaird', 'Laidlaw', 'Lamont', 'Leckie', 'Lindores', 'Lockhart', 'Lumsden', 'Maitland', 'Menzies', 'Moncrieff', 'Muirhead', 'Nairn', 'Napier', 'Ogilvie', 'Orrock', 'Pitcairn', 'Primrose', 'Rattray', 'Renton', 'Rintoul', 'Sandilands', 'Seton', 'Spence', 'Strachan', 'Swinton', 'Tennant', 'Torrance', 'Tulloch', 'Urquhart', 'Veitch', 'Wardlaw', 'Wemyss', 'Whyte', 'Yuill', 'Affleck', 'Bisset', 'Brodie', 'Callander', 'Cockburn', 'Dalziel', 'Dougall', 'Fordyce', 'Garvie', 'Hepburn', 'Lauder', 'Lorimer', 'Mowat', 'Pringle', 'Ritchie', 'Tosh', 'Wishart']

const assigned = new Map() // original identity -> { first, last }
const taken = new Set([...originals, ...sponsors])
function person(identity) {
  let p = assigned.get(identity)
  if (p) return p
  const h = createHash('sha256').update(identity).digest()
  for (let i = 0; ; i++) {
    const first = FIRST[(h.readUInt16BE(0) + i) % FIRST.length]
    const last = LAST[(h.readUInt16BE(2) + i * 7) % LAST.length]
    const key = normalizeName(`${first} ${last}`)
    if (taken.has(key)) continue
    taken.add(key)
    p = { first, last }
    assigned.set(identity, p)
    return p
  }
}
// A full name in, its stand-in out (names with no letters are the old app's
// quirks, not people: kept).
const rename = (name) => {
  if (!hasLetters(name)) return name
  const p = person(normalizeName(name))
  return `${p.first} ${p.last}`
}
const renameKey = (key) => (hasLetters(key) ? normalizeName(rename(key)) : key)
// firstName/lastName in place, from the pair's identity.
function renameParts(r) {
  const name = fullName(r)
  if (!hasLetters(name)) return r
  const p = person(normalizeName(name))
  return { ...r, firstName: p.first, lastName: p.last }
}
const without = (r, keys) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k)))
const mapValues = (o, f) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v, k)])) : o)
const mapKeys = (o, f) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [f(k), v])) : o)

// --- The rebuilt tree.
const out = {}
for (const k of KEEP) if (data[k] !== undefined) out[k] = structuredClone(data[k])

out.competitions = mapValues(out.competitions, (c) => {
  const r = without(c, ['image', 'invites', 'staff', 'submissionId'])
  if (r.description) r.description = '<p>Entries, prizes and the day’s timings from the organisers.</p>'
  if (r.registrationURL) r.registrationURL = 'https://example.com/register'
  if (r.links) {
    let n = 0
    r.links = mapValues(r.links, (l) => ({ ...l, name: `Link ${++n}`, ...(l.url ? { url: `https://example.com/link-${n}` } : {}) }))
  }
  return r
})

out['competitions:data'] = mapValues(out['competitions:data'], (c) => {
  const r = without(c, ['invites'])
  r.dancers = mapValues(r.dancers, renameParts)
  r.staff = mapValues(r.staff, (s) => renameParts(without(s, ['description', 'image', 'website'])))
  r.groups = mapValues(r.groups, (g) => {
    const next = { ...g }
    if (typeof g.sponsor === 'string' && !c.staff?.[g.sponsor]) next.sponsor = rename(g.sponsor)
    if (g.trophy) next.trophy = `${person(normalizeName(g.trophy)).last} Memorial Trophy`
    return next
  })
  return r
})

for (const ns of PEOPLE) {
  out[ns] = mapValues(out[ns], (a) => {
    const r = without(a, ['image'])
    r.name = rename(a.name)
    if (a._identity) r._identity = renameKey(a._identity)
    r.appearances = mapValues(a.appearances, (ap) => renameParts(without(ap, ['bio', 'image', 'website', 'description'])))
    return r
  })
  out[`${ns}:index`] = mapKeys(
    mapValues(out[`${ns}:index`], (e) => ({ ...without(e, ['image']), ...(e.name ? { name: rename(e.name) } : {}) })),
    renameKey,
  )
  out[`${ns}:retired`] = mapKeys(out[`${ns}:retired`], renameKey)
}

out.series = mapValues(out.series, (s) => without(s, ['image']))

// --- Nothing of anyone left: no original full name, in any run of words in
// any key or value, and nothing that looks like an email address.
const fullOriginals = new Set([...originals].filter((n) => n.includes(' ')))
const leaks = []
;(function walk(v, path) {
  const check = (s, where) => {
    const words = normalizeName(s).split(' ')
    for (let i = 0; i < words.length; i++)
      for (let n = 2; n <= 4 && i + n <= words.length; n++)
        if (fullOriginals.has(words.slice(i, i + n).join(' '))) leaks.push(`${where}: ${s}`)
    if (/[\w.+-]+@[\w-]+\.\w{2,}/.test(s)) leaks.push(`${where}: an email? ${s}`)
  }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      check(k, `${path}/${k} (key)`)
      walk(x, `${path}/${k}`)
    }
  } else if (typeof v === 'string') check(v, path)
})(out, '')
if (leaks.length) {
  console.error(`Not written: ${leaks.length} strings still look like someone's:\n${leaks.slice(0, 20).join('\n')}`)
  process.exit(1)
}

const json = JSON.stringify({ [NS]: out })
writeFileSync(join(here, 'database.json.gz'), gzipSync(json, { level: 9 }))
console.log(`${assigned.size} people renamed; ${Math.round(json.length / 1024)} KB, ${Math.round(gzipSync(json).length / 1024)} KB gzipped.`)
