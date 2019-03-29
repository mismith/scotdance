import { postmark } from './utility/email';
import { attachUserToCompetition } from './utility/competition';

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
    const { submissionId } = ctx.params;
    const submission = snap.val();
    const model = this.getTemplateModel(submission);

    // send emails
    await postmark.sendEmailWithTemplate({
      From: this.config.email,
      To: this.config.env === 'development' ? this.config.email : submission.contact.email,
      TemplateAlias: 'competition-submission',
      TemplateModel: model,
    });
    await postmark.sendEmailWithTemplate({
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

  async handleApproved(snap, ctx) {
    const submission = snap.val();
    const model = this.getTemplateModel(submission);
    const { competition, submittedBy } = submission;

    // create competition, and give submitter admin privileges to it
    const competitionSnap = await this.config.db.child('competitions').push(competition);
    const competitionId = competitionSnap.key;
    await attachUserToCompetition({
      db: this.config.db,
      userId: submittedBy,
      competitionId,
    });

    // send email
    await postmark.sendEmailWithTemplate({
      From: this.config.email,
      To: this.config.env === 'development' ? this.config.email : submission.contact.email,
      TemplateAlias: 'competition-submission-approved',
      TemplateModel: {
        ...model,
        admin: {
          link: `${this.config.url}/#/competitions/${competitionId}/admin`,
        },
      },
    });
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
          await after.ref.update({
            submittedBy: ctx.auth.uid,
          });
          const snap = await after.ref.once('value');

          return this.handleCreate(snap, ctx);
        } catch (err) {
          return this.handleError(err, after, ctx);
        }
      }),
      onUpdate: ref.onUpdate(async ({ before, after }, ctx) => {
        try {
          // approved
          if (before.child('approved').val() !== after.child('approved').val()) {
            await after.ref.update({
              approvedBy: ctx.auth.uid,
            });
            const snap = await after.ref.once('value');

            return this.handleApproved(snap, ctx);
          }
        } catch (err) {
          return this.handleError(err, after, ctx);
        }
      }),
    };
  }
}

export default Submissions;
