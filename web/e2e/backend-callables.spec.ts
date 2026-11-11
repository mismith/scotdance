import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { dbRemove, dbSet, uid } from './support/emulator'
import { account, assistant, callFunction, type Account } from './support/backend'

// An assistant's session holds a real ID token for its owner, marked `via: 'mcp'` (ADR 0018). Called directly, with
// that token, every callable turns it away: even when its owner is a system admin, and for tool passes and
// connections. (Which callables there are is read from functions/src/index.ts, so a new one is covered the day it is added.)

test.skip(({ isMobile }) => isMobile, 'Functions only: no need to run per device')
test.describe.configure({ mode: 'serial' })
// (The first call to a utility can wait on the emulator loading the functions)
test.setTimeout(120_000)

const source = readFileSync(resolve(process.cwd(), '../functions/src/index.ts'), 'utf8')
const CALLABLES = [...source.matchAll(/export const (\w+) = \w+(?:\([^)]*\))?\s*\.onCall/g)].map((m) => m[1])

let boss: Account
let bossBot: Account

test.beforeAll(async () => {
  boss = await account(`${uid('callables-boss')}@example.test`)
  await dbSet(`users:permissions/${boss.uid}/admin`, true)
  bossBot = await assistant(boss)
})
test.afterAll(async () => {
  await dbRemove(`users:permissions/${boss.uid}`)
})

test('the callables are found', () => {
  expect(CALLABLES.length).toBeGreaterThan(25)
  // (The system admin's utilities, the tool passes, the connection pages, the links and organisations)
  for (const name of ['linkCompetitions', 'toolPass', 'unlinkTool', 'createOrganisation', 'connectionRequest', 'approveConnection', 'endConnection', 'reindexDancers', 'findCapitals', 'sendMorningSummary', 'backfillCoords']) {
    expect(CALLABLES, name).toContain(name)
  }
})

test('a system admin in person is let in to a system admin utility, and their assistant is turned away from every callable', async () => {
  // (A cheap one: the check passes, then it finds there is no such competition. Not one that scans every competition: the functions emulator has one worker.)
  const person = await callFunction('sendMorningSummary', { competitionId: 'no-such-competition' }, boss)
  expect(person.error?.status, JSON.stringify(person.error)).not.toBe('PERMISSION_DENIED')
  const stranger = await account(`${uid('callables-stranger')}@example.test`)
  const refusedStranger = await callFunction('sendMorningSummary', { competitionId: 'no-such-competition' }, stranger)
  expect(refusedStranger.error?.status).toBe('PERMISSION_DENIED')

  for (const name of CALLABLES) {
    const answer = await callFunction(name, { audience: 'challenge', competitionId: 'x', request: 'x', name: 'x' }, bossBot)
    expect(answer.error?.status, name).toBe('PERMISSION_DENIED')
    expect(answer.error?.message, name).toBe('AI assistants can’t do this.')
  }
})
