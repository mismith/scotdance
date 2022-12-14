import seed from '../../helpers/seed';
import { createUser, USER_CREDENTIALS, USER_UID } from '../../helpers/user';
import { COMPETITION_UID, createCompetition } from '../../helpers/competition';

beforeEach(() => {
  seed.reset();

  cy.clearLocalStorage();
  cy.clearCookies();
});

describe('Competition', () => {
  beforeEach(() => {
    Object.values(COMPETITION_UID).forEach((uid) => {
      if (uid === COMPETITION_UID.MISSING) return;

      createCompetition(uid);
    });
  });

  /**
   *              |  UNAUTHED  |   AUTHED   |  PERMED  |   ADMIN   |
   *  ------------|------------|------------|----------|-----------|
   *  MISSING     |  notFound  |  notFound  | notFound | adminOnly |
   *  UNLISTED    |  notFound  |  notFound  |   full   |   full    |
   *  UNPUBLISHED | publicOnly | publicOnly |   full   |   full    |
   *  PUBLIC      |    full    |    full    |   full   |   full    |
   */
  const AUTH_STATE = {
    UNAUTHED: 'UNAUTHED',
    AUTHED: 'AUTHED',
    PERMED: 'PERMED',
    ADMIN: 'ADMIN',
  };
  const ACCESS_STATE = {
    NOT_FOUND: 'notFound',
    PUBLIC_ONLY: 'publicOnly',
    ADMIN_ONLY: 'adminOnly',
    FULL: 'full',
  };
  const TEST_MATRIX = {
    [AUTH_STATE.UNAUTHED]: {
      [COMPETITION_UID.MISSING]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNLISTED]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNPUBLISHED]: ACCESS_STATE.PUBLIC_ONLY,
      [COMPETITION_UID.PUBLIC]: ACCESS_STATE.FULL,
    },
    [AUTH_STATE.AUTHED]: {
      [COMPETITION_UID.MISSING]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNLISTED]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNPUBLISHED]: ACCESS_STATE.PUBLIC_ONLY,
      [COMPETITION_UID.PUBLIC]: ACCESS_STATE.FULL,
    },
    [AUTH_STATE.PERMED]: {
      [COMPETITION_UID.MISSING]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNLISTED]: ACCESS_STATE.FULL,
      [COMPETITION_UID.UNPUBLISHED]: ACCESS_STATE.FULL,
      [COMPETITION_UID.PUBLIC]: ACCESS_STATE.FULL,
    },
    [AUTH_STATE.ADMIN]: {
      [COMPETITION_UID.MISSING]: ACCESS_STATE.ADMIN_ONLY,
      [COMPETITION_UID.UNLISTED]: ACCESS_STATE.FULL,
      [COMPETITION_UID.UNPUBLISHED]: ACCESS_STATE.FULL,
      [COMPETITION_UID.PUBLIC]: ACCESS_STATE.FULL,
    },
  };
  Object.entries(TEST_MATRIX).forEach(([authState, tests]) => {
    describe(`Auth state: ${authState}`, () => {
      Object.entries(tests).forEach(([competitionUid, accessState]) => {
        it(`Access state: ${competitionUid}`, () => {
          switch (authState) {
            default: // eslint-disable-line default-case-last
            case AUTH_STATE.UNAUTHED: {
              break;
            }
            case AUTH_STATE.AUTHED: {
              createUser(USER_UID.TEST);
              cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[USER_UID.TEST]);
              break;
            }
            case AUTH_STATE.PERMED: {
              createUser(USER_UID.TEST);
              Object.values(COMPETITION_UID).forEach((uid) => {
                if (uid === COMPETITION_UID.MISSING) return;

                seed.database.set(`development/competitions:permissions/${uid}/users/${USER_UID.TEST}`, true);
                seed.database.set(`development/users:permissions/${USER_UID.TEST}/competitions/${uid}`, true);
              });
              cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[USER_UID.TEST]);
              break;
            }
            case AUTH_STATE.ADMIN: {
              createUser(USER_UID.ADMIN);
              cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[USER_UID.ADMIN]);
              break;
            }
          }

          if (accessState === ACCESS_STATE.ADMIN_ONLY) {
            cy.visit(`/#/competitions/${competitionUid}/info`);
            cy.getTest(`competition:access-state:${ACCESS_STATE.NOT_FOUND}`).should('exist');
            cy.visit(`/#/competitions/${competitionUid}/admin/info`);
            cy.getTest(`competition:access-state:${ACCESS_STATE.FULL}`).should('exist');
          } else {
            cy.visit(`/#/competitions/${competitionUid}/dancers`);
            cy.getTest(`competition:access-state:${accessState}`).should('exist');
          }
        });
      });
    });
  });
});
