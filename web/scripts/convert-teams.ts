// Old team rows made into teams (ADR 0012 decision 8), once, for every
// competition. Reads a copy of competitions:data, and writes what it would
// change, the way back, and a report to read first. Nothing is sent to the
// database: the write is a `firebase database:update` of applied.json.
//
//   node scripts/convert-teams.ts --data competitions-data.json [--competitions competitions.json] [--fixes fixes.json] --out <dir>
//
// `--fixes` holds rows fixed by hand ({ competitionId, dancerId, fields }),
// written as they are in place of what the script reads.
//
// Rows in age groups named for teams (duets, trios, groups…) are made teams,
// and elsewhere rows listing two or more dancers, only where nothing's in
// doubt; solo rows with a routine typed into the name ("Celtic Fairy - " |
// "Isla Grant") are tidied the same way. The rest are left as they are, and
// listed in the report with why.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { createServer } from 'vite'

const { values: args } = parseArgs({ options: { data: { type: 'string' }, competitions: { type: 'string' }, fixes: { type: 'string' }, out: { type: 'string' } } })
if (!args.data || !args.out) {
  console.error('Usage: node scripts/convert-teams.ts --data competitions-data.json [--competitions competitions.json] --out <dir>')
  process.exit(1)
}

// The reader and plan are the app's own, loaded through Vite for its `@/`
// paths, without the Firebase client they'd otherwise bring along.
const vite = await createServer({
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  plugins: [{ name: 'no-firebase', enforce: 'pre', resolveId: (id) => (id === '@/firebase' ? '\0no-firebase' : null), load: (id) => (id === '\0no-firebase' ? 'export const dataRef = () => { throw new Error("No database here") }' : null) }],
})
const { planConversion, conversionUpdates } = (await vite.ssrLoadModule('/src/lib/admin/teamPlan.ts')) as typeof import('../src/lib/admin/teamPlan.ts')
type TeamProposal = import('../src/lib/admin/teamPlan.ts').TeamProposal
type RoutineProposal = import('../src/lib/admin/teamPlan.ts').RoutineProposal
const { townsIn, nameLike, looksLikeTeamGroup, placeLike } = (await vite.ssrLoadModule('/src/lib/admin/teamReader.ts')) as typeof import('../src/lib/admin/teamReader.ts')
const { normalizeEntityName: norm } = (await vite.ssrLoadModule('/src/lib/entityIndex.ts')) as typeof import('../src/lib/entityIndex.ts')
await vite.close()

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a JSON copy of the database, read as it comes
type Row = Record<string, any>
const data: Record<string, { dancers?: Record<string, Row>; groups?: Record<string, Row>; categories?: Record<string, Row> }> = JSON.parse(readFileSync(args.data, 'utf8'))
const competitions: Record<string, Row> = args.competitions ? JSON.parse(readFileSync(args.competitions, 'utf8')) : {}
const fixes: Array<{ competitionId: string; dancerId: string; fields: Row }> = args.fixes ? JSON.parse(readFileSync(args.fixes, 'utf8')) : []
const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')

// Firebase's push keys: time first, so members keep the order they're added in.
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
let lastTime = 0
let seq = 0
function pushKey() {
  let now = Date.now()
  if (now <= lastTime) now = lastTime
  seq = now === lastTime ? seq + 1 : 0
  lastTime = now
  let time = ''
  for (let i = 0; i < 8; i++, now = Math.floor(now / 64)) time = PUSH_CHARS[now % 64] + time
  const rand = [...randomBytes(12)].map((b, i) => PUSH_CHARS[i === 11 ? (b + seq) % 64 : b % 64]).join('')
  return time + rand
}

// What all of production says, to settle what one row can't: towns (from
// Locations typed with their province: a person's name in a team's Location
// that isn't one is its teacher), dancers (a solo row's first and last name,
// outside age groups for teams) and their first names, and studios (typed in
// many rows).
const all = Object.values(data).flatMap((c) =>
  Object.values(c?.dancers ?? {})
    .filter((d) => d && typeof d === 'object' && d.team !== true)
    .map((d) => {
      const g = c.groups?.[d.groupId]
      return { d, group: `${text(c.categories?.[g?.categoryId]?.name)} ${text(g?.name)}` }
    }),
)
const places = townsIn(all.map(({ d }) => text(d.location)))
const people = new Set<string>()
const firstNames = new Set<string>()
for (const { d, group } of all) {
  const first = text(d.firstName)
  const last = text(d.lastName)
  if (!first || !last || /\s/.test(first) || looksLikeTeamGroup(group) || !nameLike(`${first} ${last}`)) continue
  people.add(norm(`${first} ${last}`))
  firstNames.add(norm(first))
}
const seen = new Map<string, number>()
for (const { d } of all)
  for (const v of new Set([text(d.location), ...[d.firstName, d.lastName].flatMap((c) => text(c).split(/\s+[-–—:]\s+|\s+[-–—]$/))].map((p) => norm(p)).filter(Boolean)))
    seen.set(v, (seen.get(v) ?? 0) + 1)
const studios = new Map([...seen].filter(([v, n]) => n >= 3 && !places.has(v) && !people.has(v) && !placeLike(v.toUpperCase())))

const applied: Record<string, unknown> = {}
const restore: Record<string, unknown> = {}
const changes: Array<{ name: string; rows: string[] }> = []
const notSure: string[] = []
// Where the unsure rows are, to open and fix them by hand.
const notSureAt: Array<{ competitionId: string; dancerId: string }> = []
const fixed: string[] = []
const totals = { teams: 0, routines: 0, notSure: 0, fixed: 0 }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const cells = (b: { firstName: string; lastName: string; location: string }) =>
  [b.firstName, b.lastName, b.location].map((c) => `<span class="cell">${esc(c) || '<i>empty</i>'}</span>`).join('')
const extra = (x: { studio: string; location: string }) => [x.studio && `Studio: ${esc(x.studio)}`, x.location && `Location: ${esc(x.location)}`].filter(Boolean).join(' · ')
const asTeam = (t: TeamProposal) =>
  `<b>${esc(t.title || '(no routine)')}</b>${t.members.length ? `<div>${t.members.map((m) => esc(`${m.firstName} ${m.lastName}`.trim())).join(', ')}</div>` : ''}<div class="muted">${extra(t)}</div>`
const asRoutine = (r: RoutineProposal) => `<b>${esc(`${r.firstName} ${r.lastName}`.trim())}</b><div>Routine: ${esc(r.title)}</div><div class="muted">${extra(r)}</div>`

for (const [competitionId, c] of Object.entries(data)) {
  if (!c?.dancers) continue
  const categories = c.categories ?? {}
  const groups = Object.entries(c.groups ?? {}).map(([id, g]) => ({ id, label: `${text(categories[g?.categoryId]?.name)} ${text(g?.name)}`.trim() }))
  const rows = Object.entries(c.dancers)
    .filter(([, d]) => d && typeof d === 'object')
    .map(([id, d]) => ({ id, num: text(d.number), firstName: text(d.firstName), lastName: text(d.lastName), location: text(d.location), groupId: d.groupId, team: d.team === true, title: text(d.title), studio: text(d.studio) }))
  const plan = planConversion(rows, groups, { places, people, firstNames, studios })
  const sure = <T extends { unsure: string[] }>(xs: T[]) => xs.filter((x) => !x.unsure.length)

  // An age group named for teams holds teams only: its rows are never solo
  // routines. Elsewhere (choreography's "Premier Group A" mixes solos and
  // groups), a row is a team when it lists two or more dancers.
  const teamGroups = new Set(plan.groups.filter((g) => g.likely).map((g) => g.group.id))
  const fixedHere = fixes.filter((f) => f.competitionId === competitionId && c.dancers![f.dancerId])
  const byHand = new Set(fixedHere.map((f) => f.dancerId))
  const teams = plan.groups.flatMap((g) => sure(g.teams).filter((t) => !byHand.has(t.id) && (g.likely || t.members.length >= 2)))
  const made = new Set([...teams.map((t) => t.id), ...byHand])
  const solos = plan.routines.filter((r) => !teamGroups.has(r.groupId) && !made.has(r.id))
  const routines = sure(solos)
  const updates = conversionUpdates({ teams, routines }, pushKey)
  // Fixed by hand: as they are, the old profile unlinked as for any team.
  for (const f of fixedHere) {
    for (const [field, value] of Object.entries(f.fields)) updates[`dancers/${f.dancerId}/${field}`] = value ?? null
    if (f.fields.team) updates[`dancers/${f.dancerId}/dancerId`] = null
  }
  for (const [path, value] of Object.entries(updates)) {
    const full = `competitions:data/${competitionId}/${path}`
    applied[full] = value
    const [, dancerId, field] = path.split('/')
    restore[full] = c.dancers[dancerId]?.[field] ?? null
  }

  const name = text(competitions[competitionId]?.name) || competitionId
  const group = (id: string) => groups.find((g) => g.id === id)?.label ?? ''
  const changed = [
    ...teams.map((t) => `<tr><td>${esc(t.num)}</td><td>${cells(t.before)}</td><td>${asTeam(t)}</td></tr>`),
    ...routines.map((r) => `<tr><td>${esc(r.num)}</td><td>${cells(r.before)}</td><td>${asRoutine(r)}</td></tr>`),
  ]
  for (const f of fixedHere) {
    const d = c.dancers[f.dancerId]
    const t = { title: text(f.fields.title), studio: text(f.fields.studio), location: text(f.fields.location), members: Object.values((f.fields.members ?? {}) as Record<string, Row>).sort((a, b) => a._order - b._order).map((m) => ({ firstName: text(m.firstName), lastName: text(m.lastName) })) }
    const row = `<tr><td>${esc(text(d.number))}</td><td>${cells({ firstName: text(d.firstName), lastName: text(d.lastName), location: text(d.location) })}</td><td>${asTeam(t as TeamProposal)}</td></tr>`
    changed.push(row)
    fixed.push(row.replace('<tr><td>', `<tr><td>${esc(name)}<div class="muted">`).replace('</td><td>', '</div></td><td>'))
  }
  if (changed.length) changes.push({ name, rows: changed })
  // Not sure: in an age group for teams, any row it doubts; elsewhere, only
  // rows listing dancers (the rest are dancers' own rows).
  const unsure = (id: string, num: string, before: TeamProposal['before'], groupLabel: string, guess: string, why: string[]) =>
    notSureAt.push({ competitionId, dancerId: id }) &&
    notSure.push(`<tr><td>${esc(name)}<div class="muted">${esc(groupLabel)} · ${esc(num)}</div></td><td>${cells(before)}</td><td>${guess}</td><td class="muted">${why.map(esc).join('<br>')}</td></tr>`)
  for (const g of plan.groups)
    for (const t of g.teams.filter((t) => !made.has(t.id) && !byHand.has(t.id) && t.unsure.length && (g.likely || t.members.length >= 2))) unsure(t.id, t.num, t.before, g.group.label, asTeam(t), t.unsure)
  for (const r of solos.filter((x) => x.unsure.length && !byHand.has(x.id))) unsure(r.id, r.num, r.before, group(r.groupId), asRoutine(r), r.unsure)
  totals.teams += teams.length
  totals.routines += routines.length
}
totals.notSure = notSure.length
totals.fixed = fixed.length
const missing = fixes.filter((f) => !data[f.competitionId]?.dancers?.[f.dancerId])
if (missing.length) console.warn(`${missing.length} fixed rows aren't in this copy: ${missing.map((f) => f.dancerId).join(', ')}`)

const html = `<!doctype html><meta charset="utf-8"><title>Old team rows</title>
<style>body{font:15px/1.45 system-ui;margin:2rem auto;max-width:72rem;padding:0 1rem}table{border-collapse:collapse;width:100%;margin-bottom:1rem}td,th{border-top:1px solid #ddd;padding:.45rem;text-align:left;vertical-align:top}.cell{display:inline-block;background:#f2f2f2;border-radius:4px;padding:0 .3rem;margin:0 .2rem .2rem 0}.muted{color:#666;font-size:13px}details{margin:.4rem 0}summary{cursor:pointer;font-weight:600}.box{background:#f6f8fb;border-radius:10px;padding:.8rem 1rem}</style>
<h1>Old team rows: what the conversion does</h1>
<div class="box">
<p><b>Nothing has changed yet.</b> Running the command in the runbook rewrites the rows under “Will change” exactly as shown there, in one update. Nothing else is touched, and <code>restore.json</code> puts every one of them back.</p>
<ul>
<li><b>${totals.teams}</b> rows typed as dancers become duets, trios and groups, with their dancers, routine and studio in their own places.</li>
<li><b>${totals.routines}</b> solo rows with the routine typed into the name get it in its own place.</li>
${totals.fixed ? `<li><b>${totals.fixed}</b> rows fixed by hand are written as fixed.</li>` : ''}
${totals.notSure ? `<li><b>${totals.notSure}</b> rows I’m not sure of stay exactly as they are. My best guess for each is below: tell me which are right and they’ll be included.</li>` : ''}
</ul>
</div>
${totals.notSure ? `<h2>Not sure: these stay as they are (${totals.notSure})</h2>
<table><tr><th>Competition</th><th>As typed (first · last · location)</th><th>My best guess</th><th>Why I’m not sure</th></tr>${notSure.join('')}</table>` : ''}
${totals.fixed ? `<h2>Fixed by hand (${totals.fixed})</h2>
<table><tr><th>Competition</th><th>As typed (first · last · location)</th><th>Becomes</th></tr>${fixed.join('')}</table>` : ''}
<h2>Will change (${totals.teams + totals.routines + totals.fixed}, in ${changes.length} competitions)</h2>
${changes
  .map((c) => `<details><summary>${esc(c.name)} (${c.rows.length})</summary><table><tr><th>No.</th><th>As typed (first · last · location)</th><th>Becomes</th></tr>${c.rows.join('')}</table></details>`)
  .join('\n')}`

mkdirSync(args.out, { recursive: true })
writeFileSync(`${args.out}/applied.json`, JSON.stringify(applied, null, 1))
writeFileSync(`${args.out}/restore.json`, JSON.stringify(restore, null, 1))
writeFileSync(`${args.out}/report.html`, html)
writeFileSync(`${args.out}/not-sure.json`, JSON.stringify(notSureAt, null, 1))
console.log(`${totals.teams} teams, ${totals.routines} routines, ${totals.fixed} fixed by hand, ${totals.notSure} not sure: ${Object.keys(applied).length} paths → ${args.out}`)
