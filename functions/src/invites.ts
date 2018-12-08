import { config } from 'firebase-functions';
import { ServerClient } from 'postmark';
import { FirebaseDynamicLinks, FirebaseInvites } from '@mismith/firebase-tools/dist/server';

const postmark = new ServerClient(config().postmark.server_api_token);

const dynamicLinks = new FirebaseDynamicLinks(
  config().fb.web_api_key,
  'info.mismith.scotdance',
  'scotdance.page.link',
);

class Invites extends FirebaseInvites {
  async handleCreate(snap, ctx) {
    // get dynamic link
    const { competitionId, inviteId } = ctx.params;
    const url = `${this.config.url}/#/competitions/${competitionId}/invites/${inviteId}`;
    const link = await dynamicLinks.getShortLink(url, true);

    // build email template
    const invite = snap.val();
    const competitionPath = `competitions/${competitionId}`;
    const competition = (await this.config.db.child(competitionPath).once('value')).val();
    const invitation = {
      From: this.config.email,
      To: this.config.env === 'development' ? this.config.email : invite.payload.email,
      TemplateAlias: 'competition-admin-invite',
      TemplateModel: {
        app: {
          name: this.config.name,
          email: this.config.email,
          url: this.config.url,
        },
        competition,
        invite: {
          ...invite,
          link,
        },
      },
    };

    // send email
    await postmark.sendEmailWithTemplate(invitation);
  }

  async attachUserToCompetition(snap, ctx, value) {
    const invite = snap.val();
    const userId = invite[FirebaseInvites.prop.ACCEPTED_BY];
    if (userId) {
      const { competitionId } = ctx.params;
      await this.config.db.child('permissions').update({
        [`users/${userId}/competitions/${competitionId}`]: value,
        [`competitions/${competitionId}/users/${userId}`]: value,
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
