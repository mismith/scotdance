import seed from './seed';

export const USER_UID = {
  TEST: 'TEST',
  ADMIN: 'ADMIN',
};

export function createUser(uid) {
  return seed.auth.createUser({
    uid,
    email: uid === USER_UID.ADMIN ? 'admin@scotdance.app' : 'test@scotdance.app',
    password: uid === USER_UID.ADMIN ? 'WelcomeAdmin1' : 'WelcomeTest1',
  }, uid === USER_UID.ADMIN);
}

export function itShouldBeAuthGuarded(requiresAdmin = false) {
  createUser(USER_UID.TEST);
  if (requiresAdmin) {
    createUser(USER_UID.ADMIN);
  }

  cy.getTest('requiresPermissionUnauthed').should('exist');
  cy.auth('signInWithEmailAndPassword', ['test@scotdance.app', 'WelcomeTest1']);
  cy.getTest('requiresPermissionUnauthed').should('not.exist');
  if (requiresAdmin) {
    cy.getTest('requiresPermissionUnauthorized').should('exist');
    cy.auth('signOut');
    cy.auth('signInWithEmailAndPassword', ['admin@scotdance.app', 'WelcomeAdmin1']);
    cy.getTest('requiresPermissionUnauthorized').should('not.exist');
    cy.getTest('requiresPermissionUnauthed').should('not.exist');
  }
}
