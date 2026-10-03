import { account, callFunction } from './backend'
import { dbRemove, dbSet } from './emulator'

// CI only (playwright.config.ts): its Typesense starts empty, and the triggers
// only add to search collections that exist. Make them, empty, the way
// System admin › Tools does, as a stand-in system admin who's gone after.
export default async function ciSetup() {
  const sys = await account(`ci-setup-${Date.now()}@example.test`)
  await dbSet(`users:permissions/${sys.uid}/admin`, true)
  try {
    for (const name of ['reindexCompetitions', 'reindexDancers', 'reindexJudges', 'reindexPipers']) {
      const r = await callFunction(name, {}, sys)
      if (r.status !== 200) throw new Error(`${name}: ${r.status} ${JSON.stringify(r.error ?? {})}`)
    }
  } finally {
    await dbRemove(`users:permissions/${sys.uid}`)
  }
}
