import { describe, expect, it } from 'vitest'
import { REASONS, emails, paragraphs, pickReason, replyEmail, replyStatus } from '@/lib/admin/submissions'

const suggestion = (value: string) => REASONS.find((r) => r.value === value)!.reply
const fresh = { reason: null, reply: '', suggested: '' }

describe('pickReason', () => {
  it('starts a reply in its words, and clears it when picked again', () => {
    const picked = pickReason(fresh, 'duplicate')
    expect(picked).toEqual({ reason: 'duplicate', reply: suggestion('duplicate'), suggested: suggestion('duplicate') })
    expect(pickReason(picked, 'duplicate')).toEqual(fresh)
  })

  it('swaps its words for another reason’s while they’re untouched', () => {
    const picked = pickReason(pickReason(fresh, 'duplicate'), 'invalid')
    expect(picked.reason).toBe('invalid')
    expect(picked.reply).toBe(suggestion('invalid'))
  })

  it('keeps a reply you’ve written (or changed) yourself', () => {
    const edited = { ...pickReason(fresh, 'duplicate'), reply: 'Is this the dancing at Cowal?' }
    expect(pickReason(edited, 'invalid')).toEqual({ ...edited, reason: 'invalid' })
    expect(pickReason(edited, 'spam')).toEqual({ ...edited, reason: 'spam' })
    expect(pickReason({ ...fresh, reply: 'My own words' }, 'duplicate').reply).toBe('My own words')
  })

  it('spam starts no reply', () => {
    expect(pickReason(pickReason(fresh, 'duplicate'), 'spam')).toEqual({ reason: 'spam', reply: '', suggested: '' })
  })
})

describe('emails', () => {
  it('only with a reply, and never for spam', () => {
    expect(emails(null, 'Hello')).toBe(true)
    expect(emails('duplicate', 'Hello')).toBe(true)
    expect(emails('duplicate', '  \n ')).toBe(false)
    expect(emails(null, null)).toBe(false)
    expect(emails('spam', 'Hello')).toBe(false)
  })
})

describe('paragraphs', () => {
  it('splits at blank lines, keeps single line breaks, and drops the rest of the space', () => {
    expect(paragraphs('  First line\nsecond line  \n\n\n  Next one \n')).toEqual([['First line', 'second line'], ['Next one']])
    expect(paragraphs('One\n \nTwo')).toEqual([['One'], ['Two']])
    expect(paragraphs('   ')).toEqual([])
  })
})

describe('replyEmail', () => {
  const competition = { name: 'Cowal Games Highland Dancing', date: '2026-08-28', venue: 'Dunoon Stadium', location: 'Dunoon' }

  it('wraps the reply in the note the template sends', () => {
    const email = replyEmail({ competition, contactName: 'Morag Fraser', reply: 'Is this the dancing at Cowal?\n\nLet me know.', signer: 'Murray Rowan' })
    expect(email.subject).toBe('About your submission of Cowal Games Highland Dancing')
    expect(email.greeting).toBe('Hello Morag Fraser,')
    expect(email.intro).toBe('Thanks for submitting Cowal Games Highland Dancing. I haven’t added it to ScotDance.app.')
    expect(email.reply).toEqual([['Is this the dancing at Cowal?'], ['Let me know.']])
    expect(email.summary).toEqual(['Cowal Games Highland Dancing', 'Friday 28 August 2026', 'Dunoon Stadium, Dunoon'])
    expect(email.signature).toEqual(['Murray', 'ScotDance.app'])
  })

  it('leaves out what it doesn’t know', () => {
    const email = replyEmail({ competition: { name: ' Strathmore Open ', location: 'Forfar' }, reply: 'Hi' })
    expect(email.greeting).toBe('Hello,')
    expect(email.summary).toEqual(['Strathmore Open', 'Forfar'])
    expect(email.signature).toEqual(['ScotDance.app'])
  })
})

describe('replyStatus', () => {
  const at = Date.parse('2026-10-06T09:00:00Z')
  const rejected = new Date(at).toISOString()
  const withReply = { rejected, rejection: { reply: 'Hello' } }

  it('has nothing to say without a reply to send', () => {
    expect(replyStatus({ rejected }, at)).toBeNull()
    expect(replyStatus({ rejected, rejection: { reason: 'spam', reply: 'Hello' } }, at)).toBeNull()
  })

  it('follows what the server says', () => {
    expect(replyStatus({ ...withReply, replied: rejected }, at)).toBe('sent')
    expect(replyStatus({ ...withReply, replyFailed: rejected }, at)).toBe('failed')
  })

  it('is sending until it hears, and gives up after a couple of minutes', () => {
    expect(replyStatus(withReply, at + 5_000)).toBe('sending')
    expect(replyStatus(withReply, at + 3 * 60_000)).toBe('failed')
  })

  it('counts from when it was last sent again', () => {
    const retried = new Date(at + 10 * 60_000).toISOString()
    const again = { rejected, rejection: { reply: 'Hello', retried } }
    expect(replyStatus(again, at + 11 * 60_000)).toBe('sending')
    expect(replyStatus(again, at + 13 * 60_000)).toBe('failed')
  })
})
