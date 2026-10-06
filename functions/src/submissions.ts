import { getPostmark } from './utility/email';
import { attachUserToCompetition } from './utility/competition';
import { organisationsForSubmission } from './organisations';
import { isEmulator } from './utility/env';

// A failed email mustn't fail the trigger: the submission (or the
// competition made from it) stands, and Murray sees it in System admin.
async function sendEmail(message) {
  try {
    await getPostmark().sendEmailWithTemplate(message);
  } catch (err) {
     
    console.error(`${message.TemplateAlias} email failed`, err);
  }
}

// Each submission emails the address it gives, so a flood of them would be a
// spam relay. Past a few a day from one account, or a few dozen an hour from
// everyone, they're kept for review but send nothing.
const HOUR = 60 * 60 * 1000;
const PER_ACCOUNT_PER_DAY = 10;
const PER_HOUR = 30;

// A reply as the template lays it out: paragraphs (split at blank lines) of
// lines, so it reads as typed (Postmark escapes each one), the same as plain
// text, and its start for the inbox preview. (The app's preview of the email,
// web/src/lib/admin/submissions.ts, splits it the same way.)
export function replyModel(reply: string) {
  const paragraphs = reply.trim().split(/\n\s*\n/)
    .map((p) => ({ lines: p.split('\n').map((line) => line.trim()).filter(Boolean) }))
    .filter((p) => p.lines.length);
  // (By character, not UTF-16 unit, so an emoji isn't cut in half.)
  const first = [...(paragraphs[0]?.lines.join(' ') ?? '')];
  return {
    paragraphs,
    text: paragraphs.map((p) => p.lines.join('\n')).join('\n\n'),
    preview: first.length > 120 ? `${first.slice(0, 119).join('')}…` : first.join(''),
  };
}

// What was submitted, in a line or two, so they know which one it's about:
// the date as "Friday 28 August 2026" (in English, a weekday too, so it can't
// be misread anywhere), and where.
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export function summary(competition: any = {}) {
  const { date, venue, location } = competition;
  const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : null;
  return {
    date: day && !Number.isNaN(day.getTime()) ? longDate.formatToParts(day).filter((p) => p.type !== 'literal').map((p) => p.value).join(' ') : null,
    where: [venue, location].filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).join(', ') || null,
  };
}

class Submissions {
  database;
  config;

  constructor(database, config = {}) {
    this.database = database;
    this.config = config;
  }

  getTemplateModel(submission) {
    return {
      app: {
        name: this.config.name,
        description: this.config.description,
        email: this.config.email,
        url: this.config.url,
      },
      ...submission,
    };
  }

  async isFlood(submission) {
    const submissions = this.config.db.child('competitions:submissions');
    const [mine, recent] = await Promise.all([
      submissions.orderByChild('submittedBy').equalTo(submission.submittedBy).get(),
      submissions.orderByChild('receivedAt').startAt(Date.now() - HOUR).get(),
    ]);
    const mineToday = Object.values(mine.val() || {})
      .filter((s: any) => s.receivedAt >= Date.now() - 24 * HOUR).length;
    return mineToday > PER_ACCOUNT_PER_DAY || recent.numChildren() > PER_HOUR;
  }

  async handleCreate(snap, ctx) {

    const { submissionId } = ctx.params;
    const submission = snap.val();
    const model = this.getTemplateModel(submission);

    if (await this.isFlood(submission)) {
      console.warn(`Submission ${submissionId} from ${submission.submittedBy}: too many lately, so no emails`);
      return;
    }

    // send emails
    await sendEmail({
      From: this.config.email,
      To: isEmulator() ? this.config.email : submission.contact.email,
      TemplateAlias: 'competition-submission',
      TemplateModel: model,
    });
    await sendEmail({
      From: this.config.email,
      ReplyTo: submission.contact.email,
      To: this.config.email,
      TemplateAlias: 'competition-submission-approval',
      TemplateModel: {
        ...model,
        admin: {
          link: `${this.config.url}/#/admin/submissions/${submissionId}`,
        },
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handleApproved(snap, ctx) {
    const submission = snap.val();
    const submissionId = snap.key;
    const model = this.getTemplateModel(submission);
    const { competition = {}, contact = {}, submittedBy } = submission;

    // create competition, linking back to submission (and vice versa)
    const competitionSnap = await this.config.db.child('competitions').push({
      ...competition,
      submissionId,
    });
    const competitionId = competitionSnap.key;
    await snap.ref.update({
      competitionId,
    });
    // give submitter admin privileges to competition
    await attachUserToCompetition({
      db: this.config.db,
      userId: submittedBy,
      competitionId,
    });
    // list it under the organisations it asked for (making the new ones, with
    // the submitter as their admin)
    const organisationIds = await organisationsForSubmission(this.config.db, submission);
    if (organisationIds.length) {
      await this.config.db.update(Object.fromEntries(
        organisationIds.map((id) => [`competitions/${competitionId}/organisations/${id}`, true]),
      ));
      await snap.ref.update({ organisationIds: Object.fromEntries(organisationIds.map((id) => [id, true])) });
    }


    // send email
    await sendEmail({
      From: this.config.email,
      To: isEmulator() ? this.config.email : contact.email,
      TemplateAlias: 'competition-submission-approved',
      TemplateModel: {
        ...model,
        admin: {
          link: `${this.config.url}/#/competitions/${competitionId}/admin`,
        },
      },
    });
  }

  // Rejected with a reply: it's emailed to them, inside a short note signed by
  // whoever rejected it. Without one (or as spam, where a reply would confirm
  // the address works) no one is told. The submission says how it went:
  // `replied`, or `replyFailed` so it can be sent again (`rejection/retried`)
  // or another way.
  async handleRejected(snap, ctx) {
    const submission = snap.val();
    const { reason, reply } = submission.rejection || {};
    if (typeof reply !== 'string' || !reply.trim() || reason === 'spam') return;
    // Approved, deleted, rejected again or sent again since (a quick change
    // of mind, or Send again tapped twice)? Then this one's moot.
    const latest = (await snap.ref.get()).val();
    if (!latest || latest.approved || latest.rejected !== submission.rejected
      || latest.rejection?.retried !== submission.rejection?.retried) return;

    const signerId = ctx.auth?.uid || submission.rejectedBy;
    const displayName = signerId ? (await this.config.db.child(`users/${signerId}/displayName`).get()).val() : null;
    const signer = typeof displayName === 'string' ? displayName.trim().split(/\s+/)[0] || null : null;

    // (Unless it's been deleted meanwhile: update() would bring it back as a shell.)
    const mark = async (fields) => {
      if ((await snap.ref.get()).exists()) await snap.ref.update(fields);
    };
    try {
      await getPostmark().sendEmailWithTemplate({
        From: this.config.email,
        To: isEmulator() ? this.config.email : submission.contact?.email,
        TemplateAlias: 'competition-submission-rejected',
        TemplateModel: {
          ...this.getTemplateModel(submission),
          competition: { ...submission.competition, name: submission.competition?.name?.trim() || 'your competition' },
          contact: { ...submission.contact, name: submission.contact?.name?.trim() || null },
          summary: summary(submission.competition),
          reply: replyModel(reply),
          signer,
        },
      });
      await mark({ replied: new Date().toISOString(), replyFailed: null });
    } catch (err) {
      console.error('competition-submission-rejected email failed', err);
      await mark({ replyFailed: new Date().toISOString() });
    }
  }

  async handleError(err, snap, ctx) {
     
    console.error(err, snap && snap.val(), ctx);
  }

  hook(path) {
    const ref = this.database.ref(`${path}/{submissionId}`);

    return {
      ref,
      onCreate: ref.onCreate(async (after, ctx) => {
        try {
          // A transaction, so a submission deleted meanwhile (an admin tidying
          // up) isn't brought back as a `{ submittedBy }` shell. (Its first try
          // sees null when nothing is cached; answering null makes the server
          // send the real value for a second try, and leaves a deleted one be.)
          // receivedAt is the server's clock, for the flood check.
          const { committed, snapshot } = await after.ref.transaction((current) => (
            current ? { ...current, submittedBy: ctx.auth ? ctx.auth.uid : 'admin', receivedAt: Date.now() } : null
          ));
          if (!committed || !snapshot.exists()) return null;

          return await this.handleCreate(snapshot, ctx);
        } catch (err) {
          return this.handleError(err, after, ctx);
        }
      }),
      onUpdate: ref.onUpdate(async ({ before, after }, ctx) => {
        try {
          // approved
          if (before.child('approved').val() !== after.child('approved').val()) {
            await after.ref.update({
              approvedBy: ctx.auth ? ctx.auth.uid : 'admin',
            });
            const snap = await after.ref.once('value');

            return await this.handleApproved(snap, ctx);
          }
          // rejected, or its reply sent again
          const rejected = after.child('rejected').val();
          const retried = after.child('rejection/retried').val();
          if (rejected && (rejected !== before.child('rejected').val() || retried !== before.child('rejection/retried').val())) {
            return await this.handleRejected(after, ctx);
          }
          return null;
        } catch (err) {
          return this.handleError(err, after, ctx);
        }
      }),
    };
  }
}

export default Submissions;
