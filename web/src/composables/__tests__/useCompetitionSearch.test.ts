import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useCompetitionSearch } from '@/composables/useCompetitionSearch'
import type { EnrichedDancer } from '@/types/competition'

const dancer = (id: string, fullName: string, number: number) =>
  ({ id, fullName, firstName: fullName.split(' ')[0], lastName: fullName.split(' ')[1], number }) as EnrichedDancer

describe('useCompetitionSearch', () => {
  const dancers = ref([dancer('a', 'Isla Ross', 231), dancer('b', 'Callum Reid', 23), dancer('c', 'Isla Grant', 105)])

  it('matches numbers from the start', () => {
    const q = ref('23')
    const found = useCompetitionSearch(dancers, q)
    expect(found.value.map((d) => d.id)).toEqual(['a', 'b'])
    q.value = '1'
    expect(found.value.map((d) => d.id)).toEqual(['c'])
  })

  it('matches names, and everyone with nothing typed', () => {
    const q = ref('callum')
    const found = useCompetitionSearch(dancers, q)
    expect(found.value.map((d) => d.id)).toEqual(['b'])
    q.value = ' '
    expect(found.value).toHaveLength(3)
  })
})
