import seed from '../helpers/seed';
import { createUser, USER_CREDENTIALS, USER_UID } from '../helpers/user';

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
  cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[USER_UID.TEST]);
  cy.getTest('requires-permission:unauthed').should('not.exist');

  if (requiresAdmin) {
    cy.getTest('requires-permission:unauthorized').should('exist');
    cy.auth('signOut');
    cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[USER_UID.ADMIN]);
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
    
    cy.getTest('submit:start').click();

    // prompt to login
    cy.get('.RequiresAuthDialog').as('dialog').should('exist');
    cy.get('@dialog').getTest('account-buttons:login').click();

    // login
    createUser(USER_UID.TEST);
    cy.get('.LoginDialog').should('exist').as('dialog');
    cy.get('@dialog').getTest('login-dialog:email-field').find('input').type(USER_CREDENTIALS[USER_UID.TEST][0]);
    cy.get('@dialog').getTest('login-dialog:password-field').find('input').type(`${USER_CREDENTIALS[USER_UID.TEST][1]}{enter}`);

    // competition info step
    cy.getTest('submit:step.competition').should('be.visible');
    cy.getTest('submit:step.competition:next').click();
    cy.getTest('submit:step.competition').find('form').as('form');
    cy.get('@form').find(':invalid').should('have.length', 3);
    cy.get('@form').find('input[name=name]').type('Competition Name');
    cy.get('@form').find('input[name=date]').type('2020-01-01');
    cy.get('@form').find('input[name=location]').type('City, Province');
    cy.get('@form').find(':invalid').should('have.length', 0);
    cy.getTest('submit:step.competition:next').click();

    // contact info step
    cy.getTest('submit:step.contact').should('be.visible');
    cy.getTest('submit:step.contact:next').click();
    cy.getTest('submit:step.contact').find('form').as('form');
    cy.get('@form').find(':invalid').should('have.length', 3);
    cy.get('@form').find('input[name=name]').type('First Last');
    cy.get('@form').find('input[name=email]').type(USER_CREDENTIALS[USER_UID.TEST][0]);
    cy.get('@form').find('input[name=disclaimer]').check({ force: true });
    cy.get('@form').find(':invalid').should('have.length', 0);
    cy.getTest('submit:step.contact:next').click();

    // success + reset
    cy.getTest('submit:submitted').should('be.visible');
    cy.getTest('submit:restart').click();
    cy.getTest('submit:step.start').should('be.visible');
    cy.getTest('submit:step.competition').should('not.be.visible');
    cy.getTest('submit:step.contact').should('not.be.visible');
    cy.getTest('submit:submitted').should('not.exist');
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
