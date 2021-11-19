beforeEach(() => {
  cy.task('firebase-admin:auth', {
    method: 'resetUsers',
  });
  cy.task('firebase-admin:database', {
    method: 'set',
    args: [
      'development',
      null,
    ],
  });

  cy.auth('signOut');
  cy.clearLocalStorage();
  cy.clearCookies();
});

describe('Top Level', () => {
  it('Home', () => {
    cy.visit('/');
    cy.get('#hero').should('exist');
    cy.get('#about').should('exist');
    cy.get('#faq').should('exist');
    cy.get('#info').should('exist');
    cy.getTest('version').should('not.contain.text', '?');
  });
  it('Settings', () => {
    cy.visit('/#/settings');
    cy.getTest('darkMode').should('exist');
    cy.getTest('resetAppCache').should('exist');
  });
  it('Policies', () => {
    cy.visit('/#/policies');
    cy.get('#privacy').should('exist');
  });
});

describe('Competitions', () => {
  it('List', () => {
    cy.visit('/#/competitions');
    cy.get('.CompetitionsList').should('exist');
  });

  it('Submit', () => {
    cy.visit('/#/competitions/submit');
    cy.get('.CompetitionsSubmit').should('exist');
  });
});

function itShouldBeAuthGuarded(requiresAdmin = false) {
  cy.task('firebase-admin:auth', {
    method: 'createUser',
    args: [{
      uid: 'USER_UID_TEST',
      email: 'test@scotdance.app',
      password: 'WelcomeTest1',
    }],
  });
  if (requiresAdmin) {
    cy.task('firebase-admin:auth', {
      method: 'createUser',
      args: [{
        uid: 'USER_UID_ADMIN',
        email: 'admin@scotdance.app',
        password: 'WelcomeAdmin1',
      }],
    });
    cy.task('firebase-admin:database', {
      method: 'set',
      args: [
        'development/users:permissions/USER_UID_ADMIN/admin',
        true,
      ],
    });
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

describe('User', () => {
  it('Profile', () => {
    cy.visit('/#/profile');
    itShouldBeAuthGuarded();
  });
});

describe('Admin', () => {
  it('Info', () => {
    cy.visit('/#/admin');
    itShouldBeAuthGuarded(true);
  });

  it('Submissions', () => {
    cy.visit('/#/admin/submissions');
    itShouldBeAuthGuarded(true);
  });

  it('Users', () => {
    cy.visit('/#/admin/users');
    itShouldBeAuthGuarded(true);
  });
});
