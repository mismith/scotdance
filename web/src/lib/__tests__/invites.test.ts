import { describe, expect, it } from 'vitest'
import { inviteStatus } from '@/lib/admin/invites'

const now = Date.parse('2026-10-01T12:00:00Z')
const before = '2026-10-01T11:00:00.000Z'
const later = '2026-10-02T12:00:00.000Z'

describe('inviteStatus', () => {
  it('is pending once sent', () => {
    expect(inviteStatus({ created: before, payload: { email: 'a@b.c' } }, now)).toBe('pending')
  })

  it('counts as accepted only once the server has given access', () => {
    expect(inviteStatus({ created: before, accepted: before }, now)).toBe('accepting')
    expect(inviteStatus({ created: before, accepted: before, acceptedBy: 'uid' }, now)).toBe('accepted')
  })

  it('is cancelled when the server turned an accept down for that', () => {
    expect(inviteStatus({ created: before, cancelled: before }, now)).toBe('cancelled')
    expect(inviteStatus({ created: before, cancelled: before, accepted: before }, now)).toBe('cancelled')
    // Accepted (access given) before anyone tried to cancel it: still accepted.
    expect(inviteStatus({ created: before, cancelled: before, accepted: before, acceptedBy: 'uid' }, now)).toBe('accepted')
  })

  it('expires, and future dates (e.g. a resend undone) don’t count yet', () => {
    expect(inviteStatus({ created: before, expires: before }, now)).toBe('expired')
    expect(inviteStatus({ created: before, expires: later }, now)).toBe('pending')
    expect(inviteStatus({ created: before, cancelled: later }, now)).toBe('pending')
  })

  it('handles v3 invites with odd shapes', () => {
    expect(inviteStatus({}, now)).toBe('pending')
    expect(inviteStatus({ created: before, accepted: 'not a date', acceptedBy: 'uid' }, now)).toBe('pending')
  })
})
