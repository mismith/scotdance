import seed from '../helpers/seed';
import { createUser } from '../helpers/user';

beforeEach(() => {
  seed.reset();

  cy.clearLocalStorage();
  cy.clearCookies();
});

function itShouldBeAuthGuarded(requiresAdmin = false) {
  createUser(USER_UID.TEST);
  if (requiresAdmin) {
    createUser(USER_UID.ADMIN);
  }

  cy.getTest('requires-permission:unauthed').should('exist');
  cy.auth('signInWithEmailAndPassword', ['test@scotdance.app', 'WelcomeTest1']);
  cy.getTest('requires-permission:unauthed').should('not.exist');

  if (requiresAdmin) {
    cy.getTest('requires-permission:unauthorized').should('exist');
    cy.auth('signOut');
    cy.auth('signInWithEmailAndPassword', ['admin@scotdance.app', 'WelcomeAdmin1']);
    cy.getTest('requires-permission:unauthorized').should('not.exist');
    cy.getTest('requires-permission:unauthed').should('not.exist');
  }
}

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
    cy.getTest('dark-mode').should('exist');
    cy.getTest('reset-app-cache').should('exist');
  });
  it('Policies', () => {
    cy.visit('/#/policies');
    cy.get('#privacy').should('exist');
  });
});

describe('Competitions', () => {
  it('Submit', () => {
    cy.visit('/#/competitions/submit');
    cy.get('.CompetitionsSubmit').should('exist');
  });

  it('List', () => {
    cy.visit('/#/competitions');
    cy.get('.CompetitionsList').should('exist');
  });
});

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
