import seed from '../helpers/seed';
import { createUser, USER_CREDENTIALS, USER_UID } from '../helpers/user';

beforeEach(() => {
  seed.reset();

  cy.clearLocalStorage();
  cy.clearCookies();
});

const competitionId = 'UNLISTED';
function isShouldBeAuthGuarded(requiresPerms = false) {
  createUser(USER_UID.TEST);
  cy.getTest('competition:access-state:notFound').should('exist');
  cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[USER_UID.TEST]);

  if (requiresPerms) {
    seed.database.set(`development/competitions:permissions/${competitionId}/users/${USER_UID.TEST}`, true);
    seed.database.set(`development/users:permissions/${USER_UID.TEST}/competitions/${competitionId}`, true);
    cy.getTest('requires-permission:unauthorized').should('not.exist');
  }

  cy.getTest('competition:access-state:notFound').should('not.exist');
}

describe('Competition Admin', () => {
  beforeEach(() => {
    seed.database.set(`development/competitions/${competitionId}`, {
      name: `Competition ${competitionId}`,
    });
  });

  describe('Info', () => {
    describe('Permissions', () => {
      const emailToInvite = USER_CREDENTIALS[USER_UID.OTHER][0];
      beforeEach(() => {
        // ensure subsection is auth guarded
        cy.visit(`/#/competitions/${competitionId}/admin/info/permissions`);
        isShouldBeAuthGuarded(true);

        // invite user to be competition admin
        cy.getTest('invites:email-field').find('input').type(`${emailToInvite}{enter}`);
      });

      it('Invite happy path', () => {
        seed.database.get(`development/competitions:data/${competitionId}/invites`).then((invites) => {
          const [inviteId] = Object.keys(invites);

          // ensure invite was created
          cy.getTest(`invites:invite:${inviteId}:email`).should('contain.text', emailToInvite);

          // log in as the invited user and simulate viewing the invite as if the emailed link was clicked
          cy.auth('signOut');
          createUser(USER_UID.OTHER);
          cy.getTest('competition:access-state:notFound').should('exist');
          cy.visit(`#/competitions/${competitionId}/invites/${inviteId}`);
          cy.getTest('requires-permission:unauthed').should('exist');
          cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[USER_UID.OTHER]);
          cy.getTest('requires-permission:unauthed').should('not.exist');

          // accept the invite
          cy.getTest('invite:accept').click();

          // follow the CTA
          cy.getTest('invite:administer').click();
          cy.url().should('contain', `/#/competitions/${competitionId}/admin/info`);

          // ensure user is listed as a competition admin
          cy.visit(`/#/competitions/${competitionId}/admin/info/permissions`);
          cy.getTest(`invites:admin:${inviteId}:email`).should('contain.text', emailToInvite);

          // test removing self from being an admin
          cy.getTest(`invites:admin:${inviteId}:remove`).click();
          cy.getTest(`dialog-card:submit`).click();
          cy.getTest('competition:access-state:notFound').should('exist');
        });
      });

      it('Invite administration', () => {
        seed.database.get(`development/competitions:data/${competitionId}/invites`).then((invites) => {
          const [inviteId] = Object.keys(invites);

          // invited
          cy.getTest(`invites:invite:${inviteId}:email`).should('contain.text', emailToInvite);
          cy.getTest(`invites:invite:${inviteId}:status:invited`).should('exist');

          // resend
          cy.getTest(`invites:invite:${inviteId}:resend`).click();
          cy.getTest(`invites:invite:${inviteId}:status:invited`).should('exist');

          // cancel
          cy.getTest(`invites:invite:${inviteId}:cancel`).click();
          cy.getTest(`invites:invite:${inviteId}:status:cancelled`).should('exist');

          // delete
          cy.getTest(`invites:invite:${inviteId}:resend`).click();
          cy.getTest(`invites:invite:${inviteId}:cancel`).click();
          cy.getTest(`invites:invite:${inviteId}:delete`).click();
          cy.getTest(`invites:invite:${inviteId}:email`).should('not.exist');
        });
      });
    });
  });
});