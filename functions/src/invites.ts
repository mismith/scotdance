import { config } from 'firebase-functions';
import { FirebaseDynamicLinks, FirebaseInvites } from '@mismith/firebase-tools/dist/server';

import { postmark } from './utility/email';
import { attachUserToCompetition } from './utility/competition';
import { isCypress, isEmulator } from './utility/env';

const dynamicLinks = new FirebaseDynamicLinks(
  config().fb?.web_api_key || 'MISSING',
  'info.mismith.scotdance',
  'scotdance.page.link',
);

class Invites extends FirebaseInvites {
  async handleCreate(snap, ctx) {
    if (isCypress()) return;

    // get dynamic link
    const { competitionId, inviteId } = ctx.params;
    const url = `${this.config.url}/#/competitions/${competitionId}/invites/${inviteId}`;
    const link = await dynamicLinks.getShortLink(url, true);

    // send email
    const invite = snap.val();
    const competitionPath = `competitions/${competitionId}`;
    const competition = (await this.config.db.child(competitionPath).once('value')).val();
    await postmark.sendEmailWithTemplate({
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
    } else {
      console.warn(`[attachUserToCompetition]: missing acceptedBy userId`);
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
