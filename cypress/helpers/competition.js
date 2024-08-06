import seed from './seed';
import { createUser, USER_CREDENTIALS } from './user';

export const COMPETITION_UID = {
  MISSING: 'MISSING',
  UNLISTED: 'UNLISTED',
  UNPUBLISHED: 'UNPUBLISHED',
  PUBLIC: 'PUBLIC',
};

export function createCompetition(uid) {
  return seed.database.set(`development/competitions/${uid}`, {
    name: `Competition ${uid}`,
    listed: uid === COMPETITION_UID.UNPUBLISHED || uid === COMPETITION_UID.PUBLIC || null,
    published: uid === COMPETITION_UID.PUBLIC || null,
    date: new Date().toISOString(),
  });
}

export function grantUserCompetitionPermissions(competitionId, userId) {
  seed.database.set(`development/competitions:permissions/${competitionId}/users/${userId}`, true);
  seed.database.set(`development/users:permissions/${userId}/competitions/${competitionId}`, true);
}

export function itShouldBeAuthGuarded(competitionId, userId, requiresPerms = false) {
  createUser(userId);
  cy.getTest('competition:access-state:notFound').should('exist');
  cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[userId]);

  if (requiresPerms) {
    grantUserCompetitionPermissions(competitionId, userId);
    cy.getTest('requires-permission:unauthorized').should('not.exist');
  }

  cy.getTest('competition:access-state:notFound').should('not.exist');
}
