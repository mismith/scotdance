import { describe, expect, it } from 'vitest'
import { manageTarget } from '@/lib/manageTarget'

// The pencil on a competition's page opens the same thing in Manage.

const at = (name: string, params: Record<string, string> = {}, hash = '') => manageTarget({ name, params: { competitionId: 'c1', ...params }, hash }, 'c1')

describe('manageTarget', () => {
  it('opens the matching section, at the same dancer, age group, dance or day', () => {
    expect(at('competition.dancers')).toEqual({ name: 'manage.dancers', params: { competitionId: 'c1' } })
    expect(at('competition.dancer', { dancerId: 'd1' })).toEqual({ name: 'manage.dancers', params: { competitionId: 'c1', itemId: 'd1' } })
    expect(at('competition.schedule')).toEqual({ name: 'manage.schedule', params: { competitionId: 'c1' } })
    expect(at('competition.event', { dayId: 'day1', blockId: 'b1', eventId: 'e1' })).toEqual({ name: 'manage.schedule', params: { competitionId: 'c1', dayId: 'day1' } })
    expect(at('competition.results')).toEqual({ name: 'manage.results', params: { competitionId: 'c1' } })
    expect(at('competition.group', { groupId: 'g1' }, '#dance-fling')).toEqual({ name: 'manage.results', params: { competitionId: 'c1', groupId: 'g1', danceId: 'fling' } })
    expect(at('competition.group', { groupId: 'g1' })).toEqual({ name: 'manage.results', params: { competitionId: 'c1', groupId: 'g1', danceId: undefined } })
  })

  it('opens the overview from anywhere else', () => {
    expect(at('competition.info')).toEqual({ name: 'manage', params: { competitionId: 'c1' } })
  })
})
