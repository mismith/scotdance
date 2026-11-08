// One-off (ADR 0017): note the tools people already signed in to with
// ScotDance.app, from each tool's own Auth users, as toolPass now does.
//
//   npx firebase auth:export binder.json --format=json --project scotdance-binder
//   npx firebase auth:export challenge.json --format=json --project scotdance-challenge
//   node functions/scripts/backfill-tool-links.mjs binder.json challenge.json > links.json
//   npx firebase database:update /production/users:tools links.json --instance scotdance --project firebase-scotdance
//
// Binder's uids are ScotDance.app's; Challenge's are `sd_` + it (others there
// are anonymous). Keep the exports out of the repo: they hold emails.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const TOOLS = {
  binder: (id) => id,
  challenge: (id) => (id.startsWith('sd_') ? id.slice(3) : null),
}

const out = {}
for (const file of process.argv.slice(2)) {
  const tool = basename(file, '.json')
  const uidOf = TOOLS[tool]
  if (!uidOf) throw new Error(`Name each export after its tool (${Object.keys(TOOLS).join(', ')}): ${file}`)
  for (const user of JSON.parse(readFileSync(file, 'utf8')).users ?? []) {
    const uid = uidOf(user.localId)
    if (!uid) continue
    const linkedAt = Number(user.createdAt)
    out[`${uid}/${tool}`] = { linkedAt, signedInAt: Number(user.lastSignedInAt) || linkedAt }
  }
}
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
console.error(`${Object.keys(out).length} links`)
