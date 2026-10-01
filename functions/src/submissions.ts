import { getPostmark } from './utility/email';
import { attachUserToCompetition } from './utility/competition';
import { isCypress, isEmulator } from './utility/env';

// A failed email mustn't fail the trigger: the submission (or the
// competition made from it) stands, and Murray sees it in System admin.
async function sendEmail(message) {
  try {
    await getPostmark().sendEmailWithTemplate(message);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`${message.TemplateAlias} email failed`, err);
  }
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

  async handleCreate(snap, ctx) {
    if (isCypress()) return;

    const { submissionId } = ctx.params;
    const submission = snap.val();
    const model = this.getTemplateModel(submission);

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

    if (isCypress()) return;

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

  // eslint-disable-next-line class-methods-use-this
  async handleError(err, snap, ctx) {
    // eslint-disable-next-line no-console
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
          const { committed, snapshot } = await after.ref.transaction((current) => (
            current ? { ...current, submittedBy: ctx.auth ? ctx.auth.uid : 'admin' } : null
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
        } catch (err) {
          return this.handleError(err, after, ctx);
        }
      }),
    };
  }
}

export default Submissions;
