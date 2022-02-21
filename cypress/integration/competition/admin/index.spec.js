import path from 'path';

import seed from '../../../helpers/seed';
import {
  createCompetition,
  grantUserCompetitionPermissions,
  itShouldBeAuthGuarded,
  COMPETITION_UID,
} from '../../../helpers/competition';
import {
  createUser,
  USER_CREDENTIALS,
  USER_UID,
} from '../../../helpers/user';

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

    cy.getTest('admin:toolbar.import').click();

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

  describe('Tables views', () => {
    beforeEach(() => {
      createUser(userId);
      grantUserCompetitionPermissions(competitionId, userId);
      cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[userId]);
    });

    describe('Empty states', () => {
      const TOOLBAR = {
        PRESETS: 'preset-picker:button',
        IMPORT: 'admin:toolbar.import',
        SEARCH: 'admin:toolbar.hot-search',
        EXPORT: 'admin:toolbar.export',
        SAVED: 'admin:toolbar.saved',
      };
      const HOT = {
        HOT: 'admin:hot',
        EMPTY: 'admin:hot.empty-state',
        GROUPS: 'admin:hot.empty-state.groups',
        DANCERS: 'admin:hot.empty-state.dancers',
        OTHER: 'admin:hot.empty-state.other',
        PRESETS: 'admin:hot.empty-state.presets',
        IMPORT: 'admin:hot.empty-state.import',
      };
      const map = {
        staff: {
          [TOOLBAR.PRESETS]: false,
          [TOOLBAR.IMPORT]: false,
          [TOOLBAR.SEARCH]: [false, true],
          [TOOLBAR.EXPORT]: [false, true],
          [TOOLBAR.SAVED]: true,
          [HOT.HOT]: true,
          [HOT.EMPTY]: [true, false],
          [HOT.GROUPS]: false,
          [HOT.DANCERS]: false,
          [HOT.OTHER]: [true, false],
          [HOT.PRESETS]: false,
          [HOT.IMPORT]: false,
        },
        dances: {
          [TOOLBAR.PRESETS]: true,
          [TOOLBAR.IMPORT]: false,
          [TOOLBAR.SEARCH]: [false, true],
          [TOOLBAR.EXPORT]: [false, true],
          [TOOLBAR.SAVED]: true,
          [HOT.HOT]: true,
          [HOT.EMPTY]: [true, false],
          [HOT.GROUPS]: false,
          [HOT.DANCERS]: false,
          [HOT.OTHER]: [true, false],
          [HOT.PRESETS]: [true, false],
          [HOT.IMPORT]: false,
        },
        categories: {
          [TOOLBAR.PRESETS]: true,
          [TOOLBAR.IMPORT]: true,
          [TOOLBAR.SEARCH]: [false, true],
          [TOOLBAR.EXPORT]: [false, true],
          [TOOLBAR.SAVED]: true,
          [HOT.HOT]: true,
          [HOT.EMPTY]: [true, false],
          [HOT.GROUPS]: false,
          [HOT.DANCERS]: false,
          [HOT.OTHER]: [true, false],
          [HOT.PRESETS]: [true, false],
          [HOT.IMPORT]: [true, false],
        },
        groups: {
          [TOOLBAR.PRESETS]: [false, true, true],
          [TOOLBAR.IMPORT]: true,
          [TOOLBAR.SEARCH]: [false, true],
          [TOOLBAR.EXPORT]: [false, true],
          [TOOLBAR.SAVED]: true,
          [HOT.HOT]: [false, true, true],
          [HOT.EMPTY]: [true, false],
          [HOT.GROUPS]: [true, false, false],
          [HOT.DANCERS]: false,
          [HOT.OTHER]: [false, false, true],
          [HOT.PRESETS]: [false, false, true],
          [HOT.IMPORT]: [true, false],
        },
        dancers: {
          [TOOLBAR.PRESETS]: false,
          [TOOLBAR.IMPORT]: true,
          [TOOLBAR.SEARCH]: [false, true],
          [TOOLBAR.EXPORT]: [false, true],
          [TOOLBAR.SAVED]: true,
          [HOT.HOT]: [false, true, true],
          [HOT.EMPTY]: [true, false],
          [HOT.GROUPS]: false,
          [HOT.DANCERS]: [true, false, false],
          [HOT.OTHER]: [false, false, true],
          [HOT.PRESETS]: false,
          [HOT.IMPORT]: [true, false],
        },
        platforms: {
          [TOOLBAR.PRESETS]: true,
          [TOOLBAR.IMPORT]: false,
          [TOOLBAR.SEARCH]: [false, true],
          [TOOLBAR.EXPORT]: [false, true],
          [TOOLBAR.SAVED]: true,
          [HOT.HOT]: true,
          [HOT.EMPTY]: [true, false],
          [HOT.GROUPS]: false,
          [HOT.DANCERS]: false,
          [HOT.OTHER]: [true, false],
          [HOT.PRESETS]: [true, false],
          [HOT.IMPORT]: false,
        },
      };
      const addData = {
        staff() {
          seed.database.set(`development/competitions:data/${competitionId}/staff/STAFF`, {
            firstName: 'Staff',
          });
        },
        dances() {
          seed.database.set(`development/competitions:data/${competitionId}/dances/DANCE`, {
            name: 'Dance',
          });
        },
        categories() {
          seed.database.set(`development/competitions:data/${competitionId}/categories/CATEGORY`, {
            name: 'Category',
          });
        },
        groups() {
          seed.database.set(`development/competitions:data/${competitionId}/groups/GROUP`, {
            name: 'Group',
          });
        },
        dancers() {
          seed.database.set(`development/competitions:data/${competitionId}/dancers/DANCER`, {
            firstName: 'Dancer',
          });
        },
        platforms() {
          seed.database.set(`development/competitions:data/${competitionId}/platforms/PLATFORM`, {
            name: 'Platform',
          });
        },
      };
      const preReqs = {
        groups() {
          addData.categories();
        },
        dancers() {
          addData.groups();
        },
      };
      const CASES = [
        'empty',
        'with data',
        'has prereqs',
      ];

      CASES.forEach((cond, i) => {
        it(cond, () => {
          Object.entries(map).forEach(([page, config]) => {
            if (i === 1) {
              addData[page]?.();
            } else if (i === 2) {
              preReqs[page]?.();
            }
            cy.visit(`/#/competitions/${competitionId}/admin/${page}`);
            Object.entries(config).forEach(([selector, condition]) => {
              let visible = condition;
              if (Array.isArray(visible)) {
                visible = visible[i] === undefined ? visible[0] : visible[i];
              }
              cy.getTest(selector).should(visible ? 'be.visible' : 'not.exist');
            });
          });
        });
      });
    });
  });
});
