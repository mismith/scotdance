import { FirebaseInvites } from '@mismith/firebase-tools/dist/server';
import { getPostmark } from './utility/email';
import { attachUserToCompetition } from './utility/competition';
import { isEmulator } from './utility/env';
import { appModel, firstName, sendOptions, sentFrom, summary } from './utility/emailModel';

class Invites extends FirebaseInvites {
  async handleCreate(snap, ctx) {

    // The link opens the app the invite was sent from (utility/emailModel.ts).
    const { competitionId, inviteId } = ctx.params;
    const invite = snap.val();
    const from = sentFrom(invite.origin);
    const link = from.v4
      ? `${from.url}/competitions/${competitionId}/invites/${inviteId}`
      : `${from.url}/#/competitions/${competitionId}/invites/${inviteId}`;

    // send email
    const competitionPath = `competitions/${competitionId}`;
    const competition = (await this.config.db.child(competitionPath).once('value')).val();
    const inviter = await firstName(this.config.db, invite.createdBy);
    try {
      await getPostmark().sendEmailWithTemplate({
        From: this.config.email,
        To: isEmulator() ? this.config.email : invite.payload.email,
        ...sendOptions(from.v4 ? 'competition-invite' : 'competition-admin-invite'),
        TemplateModel: {
          app: appModel(this.config, from),
          competition,
          summary: summary(competition ?? undefined),
          inviter: inviter && { name: inviter },
          invite: {
            ...invite,
            link,
          },
        },
      });
      if (invite.emailFailed) await snap.ref.update({ emailFailed: null });
    } catch (err) {
       
      console.error('invite email failed', err);
      // The invite stands without its email (throwing would only kill the
      // trigger): flag it, unless it's been deleted since, so the organiser
      // can send the link another way.
      if ((await snap.ref.child('created').once('value')).exists()) {
        await snap.ref.update({ emailFailed: new Date().toISOString() });
      }
    }
  }

  async attachUserToCompetition(snap, ctx, value) {
    const invite = snap.val();
    const userId = invite[FirebaseInvites.keys.acceptedBy];
    if (userId) {
      const { competitionId } = ctx.params;
      await attachUserToCompetition({
        db: this.config.db,
        userId,
        competitionId,
        value,
      });
    }
  }

  async handleAccept(snap, ctx) {
    await this.attachUserToCompetition(snap, ctx, true);
  }

  async handleDelete(snap, ctx) {
    await this.attachUserToCompetition(snap, ctx, null);
  }
}

export default Invites;
