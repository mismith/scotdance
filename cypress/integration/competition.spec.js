import seed from '../helpers/seed';
import { USER_UID, createUser } from '../helpers/user';

beforeEach(() => {
  seed.reset();

  cy.clearLocalStorage();
  cy.clearCookies();
});

describe('Competition', () => {
  const COMPETITION_UID = {
    MISSING: 'MISSING',
    UNLISTED: 'UNLISTED',
    UNPUBLISHED: 'UNPUBLISHED',
    PUBLIC: 'PUBLIC',
  };
  beforeEach(() => {
    Object.values(COMPETITION_UID).forEach((uid) => {
      if (uid === COMPETITION_UID.MISSING) return;

      seed.database.set(`development/competitions/${uid}`, {
        name: `Competition ${uid}`,
        listed: uid === COMPETITION_UID.UNPUBLISHED || uid === COMPETITION_UID.PUBLIC || null,
        published: uid === COMPETITION_UID.PUBLIC || null,
      });
    });
  });

  /**
   *              | UNAUTHED |  AUTHED  |  PERMED  |   ADMIN  |
   *  ------------|----------|----------|----------|----------|
   *  MISSING     | notFound | notFound | notFound | notFound |
   *  UNLISTED    | notFound | notFound |   full   |   full   |
   *  UNPUBLISHED |  partial |  partial |   full   |   full   |
   *  PUBLIC      |   full   |   full   |   full   |   full   |
   */
  const AUTH_STATE = {
    UNAUTHED: 'UNAUTHED',
    AUTHED: 'AUTHED',
    PERMED: 'PERMED',
    ADMIN: 'ADMIN',
  };
  const ACCESS_STATE = {
    NOT_FOUND: 'notFound',
    PARTIAL: 'partial',
    FULL: 'full',
  };
  const TEST_MATRIX = {
    [AUTH_STATE.UNAUTHED]: {
      [COMPETITION_UID.MISSING]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNLISTED]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNPUBLISHED]: ACCESS_STATE.PARTIAL,
      [COMPETITION_UID.PUBLIC]: ACCESS_STATE.FULL,
    },
    [AUTH_STATE.AUTHED]: {
      [COMPETITION_UID.MISSING]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNLISTED]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNPUBLISHED]: ACCESS_STATE.PARTIAL,
      [COMPETITION_UID.PUBLIC]: ACCESS_STATE.FULL,
    },
    [AUTH_STATE.PERMED]: {
      [COMPETITION_UID.MISSING]: ACCESS_STATE.NOT_FOUND,
      [COMPETITION_UID.UNLISTED]: ACCESS_STATE.FULL,
      [COMPETITION_UID.UNPUBLISHED]: ACCESS_STATE.FULL,
      [COMPETITION_UID.PUBLIC]: ACCESS_STATE.FULL,
    },
    [AUTH_STATE.ADMIN]: {
      [COMPETITION_UID.MISSING]: ACCESS_STATE.NOT_FOUND,
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
            default:
            case AUTH_STATE.UNAUTHED: {
              break;
            }
            case AUTH_STATE.AUTHED: {
              createUser(USER_UID.TEST);
              cy.auth('signInWithEmailAndPassword', ['test@scotdance.app', 'WelcomeTest1']);
              break;
            }
            case AUTH_STATE.PERMED: {
              createUser(USER_UID.TEST);
              Object.values(COMPETITION_UID).forEach((uid) => {
                if (uid === COMPETITION_UID.MISSING) return;

                seed.database.set(`development/competitions:permissions/${uid}/users/${USER_UID.TEST}`, true);
                seed.database.set(`development/users:permissions/${USER_UID.TEST}/competitions/${uid}`, true);
              });
              cy.auth('signInWithEmailAndPassword', ['test@scotdance.app', 'WelcomeTest1']);
              break;
            }
            case AUTH_STATE.ADMIN: {
              createUser(USER_UID.ADMIN);
              cy.auth('signInWithEmailAndPassword', ['admin@scotdance.app', 'WelcomeAdmin1']);
              break;
            }
          }

          cy.visit(`/#/competitions/${competitionUid}/dancers`);
          cy.getTest(`accessState:${accessState}`).should('exist');
        });
      });
    });
  });
});
