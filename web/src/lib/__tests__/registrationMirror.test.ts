// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { tidyRegistration as server } from '../../../../functions/src/registration'
import { tidyRegistration as app } from '@/lib/registration'

// The app's copy of the server's tidying (shown while a number's typed on Add
// a competition) reads every number the server's own tests do, the same way.
// Those cases are numbers as they were entered in production.

const cases = [...readFileSync(new URL('./functionsRegistration.test.ts', import.meta.url), 'utf8').matchAll(/tidy(?:Registration)?\('((?:[^'\\]|\\.)*)'(?:,\s*(\d{4}))?\)/g)].map(
  ([, raw, year]) => [raw.replace(/\\'/g, "'"), year ? Number(year) : undefined] as const,
)

describe('the app’s tidying mirrors the server’s', () => {
  it('has the server tests’ numbers to check', () => {
    expect(cases.length).toBeGreaterThan(40)
  })

  it.each(cases)('%s', (raw, year) => {
    expect(app(raw, year)).toEqual(server(raw, year))
  })
})
