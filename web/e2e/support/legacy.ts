import { dbGet } from './emulator'

// The old app's records the emulator starts with, which @seed tests read:
// real people locally, made-up ones in CI (seed/build.mjs), under the same
// ids. So tests find people by id and ask their name.

export const JUDGE = '-OsoH2I8uTd5UQHwDum4' // judged Premier Pre-Championship
export const DANCER = '-OsoHXgf8ThIQ81eayjM' // danced at Nationals, #1088
export const VENUE = '-OsoH8n0XvjuN0nhsvMu' // Calgary Life Church

export async function nameOf(kind: 'judges' | 'pipers' | 'dancers' | 'venues', id: string): Promise<string> {
  const name = await dbGet<string | null>(`${kind}/${id}/name`)
  if (!name) throw new Error(`The emulator has no ${kind}/${id}: is it running on the seed data?`)
  return name
}
