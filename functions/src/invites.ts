import { FirebaseInvites } from '@mismith/firebase-tools/dist/server';
import { getPostmark } from './utility/email';
import { attachUserToCompetition } from './utility/competition';
import { isEmulator } from './utility/env';

class Invites extends FirebaseInvites {
  async handleCreate(snap, ctx) {

    // get dynamic link
    const { competitionId, inviteId } = ctx.params;
    const link = `${this.config.url}/#/competitions/${competitionId}/invites/${inviteId}`;

    // send email
    const invite = snap.val();
    const competitionPath = `competitions/${competitionId}`;
    const competition = (await this.config.db.child(competitionPath).once('value')).val();
    try {
      await getPostmark().sendEmailWithTemplate({
        From: this.config.email,
        To: isEmulator() ? this.config.email : invite.payload.email,
        TemplateAlias: 'competition-admin-invite',
        TemplateModel: {
          app: {
            name: this.config.name,
            description: this.config.description,
            email: this.config.email,
            url: this.config.url,
          },
          competition,
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
