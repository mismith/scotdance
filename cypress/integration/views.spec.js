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

function itShouldBeAuthGuarded() {
  cy.task('firebase-admin:auth', {
    method: 'createUser',
    args: [{
      uid: 'TEST_USER_UID',
      email: 'test@scotdance.app',
      password: 'WelcomeTest1',
    }],
  });
  cy.task('firebase-admin:database', {
    method: 'set',
    args: [
      'development/users:permissions/TEST_USER_UID/admin',
      true,
    ],
  });

  cy.getTest('requiresPermissionUnauthed').should('exist');
  cy.auth('signInWithEmailAndPassword', ['test@scotdance.app', 'WelcomeTest1']);
  cy.getTest('requiresPermissionUnauthed').should('not.exist');
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
    itShouldBeAuthGuarded();
  });

  it('Submissions', () => {
    cy.visit('/#/admin/submissions');
    itShouldBeAuthGuarded();
  });

  it('Users', () => {
    cy.visit('/#/admin/users');
    itShouldBeAuthGuarded();
  });
});
