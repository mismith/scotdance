import { describe, expect, it } from 'vitest'
import { parseDate } from '@/lib/format'

describe('parseDate', () => {
  it('reads a bare YYYY-MM-DD as a local date', () => {
    const d = parseDate('2019-01-22')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2019, 0, 22, 0])
  })
})
