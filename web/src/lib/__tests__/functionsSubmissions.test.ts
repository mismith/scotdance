// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRtdb, snap } from './fakeRtdb'

// Rejecting a submission (functions/src/submissions.ts): a reply goes out once,
// in competition-submission-rejected, and the submission says how it went.
// Nothing goes out without a reply, for spam, or once the rejection is moot.
// Postmark is stubbed: each email that would go out lands in `postmark.sent`.

/** Database values: untyped JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const postmark = vi.hoisted(() => ({ sent: [] as Json[], fail: false, during: null as (() => void) | null }))
vi.mock('../../../../functions/src/utility/email', () => ({
  getPostmark: () => ({
    async sendEmailWithTemplate(message: Json) {
      postmark.during?.()
      if (postmark.fail) throw new Error('Inactive recipient')
      postmark.sent.push(message)
      return { MessageID: 'stub' }
    },
  }),
}))
const { default: Submissions, replyModel, summary } = await import('../../../../functions/src/submissions')

const PATH = 'competitions:submissions'
const SUBMISSION = {
  competition: { name: 'Cowal Games Highland Dancing', date: '2027-08-27', venue: ' Dunoon Stadium', location: 'Dunoon ' },
  contact: { name: 'Morag Fraser', email: 'morag@example.test' },
  submitted: '2026-10-04T09:00:00.000Z',
}
const REPLY = 'Is this the dancing at the Cowal Gathering?\nIt’s listed already.\n\n\nIf so, I can add you as one of its admins.'
const rejectedWith = (rejection: Json, at = '2026-10-06T10:00:00.000Z') => ({
  rejected: at,
  rejectedBy: 'admin-1',
  rejection,
  replied: null,
  replyFailed: null,
})

function setup() {
  const rtdb = new FakeRtdb()
  rtdb.write({ 'users/admin-1/displayName': 'Murray Rowan', [`${PATH}/s1`]: SUBMISSION })
  // The trigger builders hand back the handlers, to call as the platform would.
  const database = { ref: () => ({ onCreate: (h: Json) => h, onUpdate: (h: Json) => h }) }
  const submissions = new Submissions(database, { db: rtdb.ref(), name: 'ScotDance.app', description: 'Highland dancing event tracker', email: 'admin@scotdance.app', url: 'https://scotdance.app' })
  const { onUpdate } = submissions.hook(PATH)

  const snapshot = (value: Json) => ({
    ...snap(value),
    ref: rtdb.ref(`${PATH}/s1`),
    child: (path: string) => snap(path.split('/').reduce((v, k) => v?.[k] ?? null, value)),
  })
  /** Change the submission as the app does; returns the trigger event, to deliver now or later. */
  function change(updates: Record<string, Json>) {
    const before = rtdb.read(`${PATH}/s1`)
    rtdb.write(Object.fromEntries(Object.entries(updates).map(([k, v]) => [`${PATH}/s1/${k}`, v])))
    const after = rtdb.read(`${PATH}/s1`)
    return (uid = 'admin-1') => onUpdate({ before: snapshot(before), after: snapshot(after) }, { params: { submissionId: 's1' }, auth: { uid } })
  }
  return { rtdb, change, read: () => rtdb.read(`${PATH}/s1`) }
}

beforeEach(() => {
  postmark.sent.length = 0
  postmark.fail = false
  postmark.during = null
})

describe('a rejection with a reply', () => {
  it('is emailed once, in the note around it, signed with their first name', async () => {
    const { change, read } = setup()
    await change(rejectedWith({ reason: 'duplicate', reply: REPLY }))()
    expect(postmark.sent).toHaveLength(1)
    const [email] = postmark.sent
    expect(email).toMatchObject({ From: 'admin@scotdance.app', To: 'morag@example.test', TemplateAlias: 'competition-submission-rejected' })
    expect(email.TemplateModel).toMatchObject({
      signer: 'Murray',
      competition: { name: 'Cowal Games Highland Dancing' },
      contact: { name: 'Morag Fraser' },
      summary: { date: 'Friday 27 August 2027', where: 'Dunoon Stadium, Dunoon' },
      reply: {
        paragraphs: [{ lines: ['Is this the dancing at the Cowal Gathering?', 'It’s listed already.'] }, { lines: ['If so, I can add you as one of its admins.'] }],
        text: 'Is this the dancing at the Cowal Gathering?\nIt’s listed already.\n\nIf so, I can add you as one of its admins.',
      },
    })
    expect(read().replied).toEqual(expect.any(String))
    expect(read().replyFailed).toBeUndefined()
  })

  it('greets them by the name they gave, or just Hello', async () => {
    const { rtdb, change } = setup()
    rtdb.write({ [`${PATH}/s1/contact/name`]: '  Morag  ' })
    await change(rejectedWith({ reply: 'Hi' }))()
    rtdb.write({ [`${PATH}/s1/contact/name`]: ' ' })
    await change({ rejected: '2026-10-06T11:00:00.000Z' })()
    expect(postmark.sent.map((e) => e.TemplateModel.contact.name)).toEqual(['Morag', null])
  })

  it('is signed by whoever sends it, or not by name when they have none', async () => {
    const { rtdb, change } = setup()
    rtdb.write({ 'users/admin-2/displayName': 'Isla Ross' })
    await change(rejectedWith({ reply: 'Hi' }))('admin-2')
    await change({ rejected: '2026-10-06T11:00:00.000Z' })('admin-3')
    expect(postmark.sent.map((e) => e.TemplateModel.signer)).toEqual(['Isla', null])
  })
})

describe('no email', () => {
  it('without a reply, for spam, for an edit or for Undo', async () => {
    const { change, read } = setup()
    await change(rejectedWith({ reason: 'invalid' }))()
    await change({ 'competition/name': 'Cowal Games' })()
    await change({ rejected: null, rejectedBy: null, rejection: null })()
    await change(rejectedWith({ reason: 'spam', reply: 'Hello' }, '2026-10-06T12:00:00.000Z'))()
    await change(rejectedWith({ reply: '  \n ' }, '2026-10-06T13:00:00.000Z'))()
    expect(postmark.sent).toHaveLength(0)
    expect(read().replied).toBeUndefined()
    expect(read().replyFailed).toBeUndefined()
  })

  it('once it’s moot: approved, rejected again or deleted before the event arrives', async () => {
    // (Approved as the old admin does it, which doesn't know to clear `rejected`.)
    const approved = setup()
    const rejected = approved.change(rejectedWith({ reply: 'Hi' }))
    await approved.change({ approved: '2026-10-06T10:01:00.000Z' })()
    await rejected()
    expect(postmark.sent).toHaveLength(0)

    const again = setup()
    const first = again.change(rejectedWith({ reply: 'First' }))
    await again.change({ rejected: null, rejectedBy: null, rejection: null })()
    const second = again.change(rejectedWith({ reply: 'Second' }, '2026-10-06T10:03:00.000Z'))
    await first()
    expect(postmark.sent).toHaveLength(0)
    await second()
    expect(postmark.sent.map((e) => e.TemplateModel.reply.text)).toEqual(['Second'])

    const deleted = setup()
    const third = deleted.change(rejectedWith({ reply: 'Third' }))
    deleted.rtdb.write({ [`${PATH}/s1`]: null })
    await third()
    expect(postmark.sent).toHaveLength(1)
    expect(deleted.read()).toBeNull()
  })
})

describe('a reply that didn’t go out', () => {
  it('says so, and Send again tries once more (once, however often it’s tapped)', async () => {
    const { change, read } = setup()
    postmark.fail = true
    await change(rejectedWith({ reply: 'Hi' }))()
    expect(read().replyFailed).toEqual(expect.any(String))
    expect(read().replied).toBeUndefined()

    postmark.fail = false
    const tap = change({ 'rejection/retried': '2026-10-06T10:05:00.000Z', replyFailed: null })
    const tapAgain = change({ 'rejection/retried': '2026-10-06T10:05:01.000Z', replyFailed: null })
    await tap()
    await tapAgain()
    expect(postmark.sent).toHaveLength(1)
    expect(read().replied).toEqual(expect.any(String))
    expect(read().replyFailed).toBeUndefined()
    // Still rejected when it was.
    expect(read().rejected).toBe('2026-10-06T10:00:00.000Z')
  })

  it('isn’t brought back by its result if it’s deleted while sending', async () => {
    for (const fail of [true, false]) {
      const { change, rtdb, read } = setup()
      postmark.fail = fail
      postmark.during = () => rtdb.write({ [`${PATH}/s1`]: null })
      await change(rejectedWith({ reply: 'Hi' }))()
      expect(read()).toBeNull()
    }
  })
})

describe('the email’s model', () => {
  it('keeps the reply as typed, and starts the inbox preview with it', () => {
    const long = 'x'.repeat(130)
    expect(replyModel(`${long}\nmore`).preview).toBe(`${'x'.repeat(119)}…`)
    expect(replyModel(`${'x'.repeat(118)}🙂🙂🙂`).preview).toBe(`${'x'.repeat(118)}🙂…`)
    expect(replyModel('  One\r\n  two \n \nThree  ')).toEqual({
      paragraphs: [{ lines: ['One', 'two'] }, { lines: ['Three'] }],
      text: 'One\ntwo\n\nThree',
      preview: 'One two',
    })
  })

  it('writes what was submitted as it can', () => {
    expect(summary({ date: '2027-08-27', venue: 'Hall', location: 'Perth' })).toEqual({ date: 'Friday 27 August 2027', where: 'Hall, Perth' })
    expect(summary({ date: 'soon', location: ' Perth ' })).toEqual({ date: null, where: 'Perth' })
    expect(summary(undefined)).toEqual({ date: null, where: null })
  })
})
