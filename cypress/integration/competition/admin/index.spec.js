import path from 'path';

import seed from '../../../helpers/seed';
import { createCompetition, itShouldBeAuthGuarded, COMPETITION_UID } from '../../../helpers/competition';
import { createUser, USER_CREDENTIALS, USER_UID } from '../../../helpers/user';

beforeEach(() => {
  seed.reset();

  cy.clearLocalStorage();
  cy.clearCookies();
});

const competitionId = COMPETITION_UID.UNLISTED;
const userId = USER_UID.TEST;

describe('Competition Admin', () => {
  beforeEach(() => {
    createCompetition(competitionId);
  });

  describe('Info', () => {
    describe('Permissions', () => {
      const emailToInvite = USER_CREDENTIALS[USER_UID.OTHER][0];
      beforeEach(() => {
        // ensure subsection is auth guarded
        cy.visit(`/#/competitions/${competitionId}/admin/info/permissions`);
        itShouldBeAuthGuarded(competitionId, userId, true);

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
          cy.getTest('dialog-card:submit').click();
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

          // // expired
          // seed.database.set(`development/competitions:data/${competitionId}/invites`)
          // cy.getTest(`invites:invite:${inviteId}:cancel`).click();
          // cy.getTest(`invites:invite:${inviteId}:status:expired`).should('exist');

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

  it('Import', () => {
    cy.visit(`/#/competitions/${competitionId}/admin/dancers`);
    itShouldBeAuthGuarded(competitionId, userId, true);

    seed.database.get(`development/competitions:data/${competitionId}`).as('competitionData');
    cy.get('@competitionData').should('equal', null);

    cy.getTest('admin:import').click();

    cy.getTest('import:download-template').click();
    cy.readFile(path.join(Cypress.config('downloadsFolder'), 'ScotDance-Import-Template.xlsx')).should('exist'); // @TODO: un-hardcode filename?

    cy.getTest('import:step.1:next').find('input[type="file"]').attachFile('Import.xlsx').trigger('input', { force: true });

    // @TODO: test previous button

    cy.getTest('import:step.2:next').click();
    // @TODO: check multiple sheet support
    // @TODO: test previous button

    cy.getTest('import:step.3:next').click();
    cy.get('.AdminImport').should('not.be.visible');
    // @TODO: check 3 sheets, all with valid/good data/rows

    seed.database.get(`development/competitions:data/${competitionId}`).as('competitionData');
    cy.get('@competitionData').its('categories').then(Object.values).should('have.length', 5);
    cy.get('@competitionData').its('groups').then(Object.values).should('have.length', 15);
    cy.get('@competitionData').its('dancers').then(Object.values).should('have.length', 150);
    // @TODO: check everything is PROPERLY populated
  });
});
