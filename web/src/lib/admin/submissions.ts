// Rejecting a submission (views/admin/Submissions.vue): a reason, for the
// record, and a reply. Both are optional. A reply is emailed to them inside
// a short note (functions/src/submissions.ts sends it, as
// postmark/competition-submission-rejected); with none, no one is told. Spam
// never gets one: a reply would confirm the address works.

export type RejectReason = 'invalid' | 'duplicate' | 'spam'

export interface Rejection {
  reason?: RejectReason | null
  reply?: string | null
  /** When its reply was last sent again (after it didn't go out). */
  retried?: string | null
}

// Each reason starts a reply in your words, to change or clear.
export const REASONS: ReadonlyArray<{ value: RejectReason; label: string; reply: string }> = [
  {
    value: 'invalid',
    label: 'Invalid or incomplete',
    reply: 'Some of the details looked incomplete or mistyped. If you submit it again with its full name, date and town, I’ll take another look.',
  },
  {
    value: 'duplicate',
    label: 'Already submitted',
    reply: 'Someone else has already submitted it. If you help run it, reply and I can add you as one of its admins.',
  },
  { value: 'spam', label: 'Test or spam', reply: '' },
]

export const reasonLabel = (reason?: string | null) => REASONS.find((r) => r.value === reason)?.label ?? null

/**
 * Choosing a reason (or choosing it again, to clear it). Its words replace
 * the reply only if the reply is still what the last reason put there (or
 * empty): something you've written yourself stays.
 */
export function pickReason(
  state: { reason: RejectReason | null; reply: string; suggested: string },
  value: RejectReason,
): { reason: RejectReason | null; reply: string; suggested: string } {
  const reason = state.reason === value ? null : value
  const untouched = !state.reply.trim() || state.reply === state.suggested
  if (!untouched) return { ...state, reason }
  const reply = REASONS.find((r) => r.value === reason)?.reply ?? ''
  return { reason, reply, suggested: reply }
}

/** Whether rejecting with these sends an email. */
export const emails = (reason: RejectReason | null | undefined, reply: string | null | undefined) =>
  reason !== 'spam' && !!reply?.trim()

/** The reply as the email lays it out: paragraphs (at blank lines) of lines. */
export function paragraphs(reply: string): string[][] {
  return reply
    .trim()
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((p) => p.length)
}

// The date as the email writes it, "Friday 28 August 2026" (in English, a
// weekday too, so it can't be misread anywhere), from a competition's YYYY-MM-DD.
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
function emailDate(date: unknown): string | null {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return longDate.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => p.value).join(' ')
}

export interface ReplyEmail {
  subject: string
  greeting: string
  intro: string
  reply: string[][]
  /** What they submitted: its name, date and where. */
  summary: string[]
  closing: string
  signature: string[]
}

/**
 * The email a reply goes out in, for the preview before it's sent. It says
 * what the template says: change one, change both.
 */
export function replyEmail(opts: {
  competition?: { name?: unknown; date?: unknown; venue?: unknown; location?: unknown }
  contactName?: string | null
  reply: string
  signer?: string | null
}): ReplyEmail {
  const c = opts.competition ?? {}
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const name = text(c.name) ?? 'your competition'
  const where = [text(c.venue), text(c.location)].filter(Boolean).join(', ')
  const signer = text(opts.signer)?.split(/\s+/)[0] ?? null
  return {
    subject: `About your submission of ${name}`,
    greeting: `Hello${text(opts.contactName) ? ` ${text(opts.contactName)}` : ''},`,
    intro: `Thanks for submitting ${name}. I haven’t added it to ScotDance.app.`,
    reply: paragraphs(opts.reply),
    summary: [name, emailDate(c.date), where].filter((s): s is string => !!s),
    closing: 'If you’ve any questions, just reply to this email.',
    signature: [signer, 'ScotDance.app'].filter((s): s is string => !!s),
  }
}

export type ReplyStatus = 'sending' | 'sent' | 'failed'

// A reply should be out within seconds; if the server hasn't said either way
// after this long, it isn't coming.
const GIVE_UP = 2 * 60_000

/** How a rejection's reply went, if it has one. */
export function replyStatus(
  s: { rejected?: string | null; rejection?: Rejection | null; replied?: string | null; replyFailed?: string | null },
  now = Date.now(),
): ReplyStatus | null {
  if (!emails(s.rejection?.reason, s.rejection?.reply)) return null
  if (s.replyFailed) return 'failed'
  if (s.replied) return 'sent'
  // Counted from when it was last asked for: rejected, or sent again.
  const asked = Math.max(...[s.rejected, s.rejection?.retried].map((t) => (t ? Date.parse(t) : NaN)).filter(Number.isFinite))
  return Number.isFinite(asked) && now - asked > GIVE_UP ? 'failed' : 'sending'
}
