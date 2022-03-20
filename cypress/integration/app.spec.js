import { COMPETITION_UID, createCompetition } from '../helpers/competition';
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
function loginAs(uid) {
  createUser(uid);

  // accept request to login
  cy.get('.RequiresAuthDialog').as('dialog').should('exist');
  cy.get('@dialog').getTest('account-buttons:login').click();

  // login via form
  cy.get('.LoginDialog').should('exist').as('dialog');
  cy.get('@dialog').getTest('login-dialog:email-field').find('input').type(USER_CREDENTIALS[uid][0]);
  cy.get('@dialog').getTest('login-dialog:password-field').find('input').type(`${USER_CREDENTIALS[uid][1]}{enter}`);
}

describe('App', () => {
  describe('Navbar', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.getTest('app:menu-button').should('exist');
      cy.getTest('app:submenu-button').should('not.exist');
      cy.getTest('app:user-menu-button').should('exist');
    });

    it('Submenu', () => {
      createCompetition(COMPETITION_UID.PUBLIC);
      cy.getTest('app-submenu').should('not.exist');

      // show all + badge
      cy.getTest('app:submenu-button').find('.v-badge__badge').should('exist');
      cy.getTest('app:submenu-button').click();
      cy.getTest('app-submenu').should('be.visible');
      cy.getTest('app-submenu:group.Other Competitions:action-button').click();
      cy.getTest('app-submenu').should('not.be.visible');
      cy.getTest('app:submenu-button').find('.v-badge__badge').should('exist');

      // competition click
      cy.getTest('app:submenu-button').click();
      cy.getTest('app-submenu').should('be.visible');
      cy.getTest(`app-submenu:competition.${COMPETITION_UID.PUBLIC}`).click();
      cy.getTest('app-submenu').should('not.be.visible');
      cy.url().should('contain', `/#/competitions/${COMPETITION_UID.PUBLIC}`);

      // pinning
      cy.getTest('app:submenu-button').click();
      cy.getTest('app-submenu').should('be.visible');
      cy.getTest(`app-submenu:competition.${COMPETITION_UID.PUBLIC}:pin`).click();
      loginAs(USER_UID.TEST);
      cy.getTest('app:submenu-button').click();
      cy.getTest('app-submenu').should('be.visible');
      cy.getTest('app-submenu:group.Pinned:action-button').should('exist');
      cy.getTest(`app-submenu:competition.${COMPETITION_UID.PUBLIC}:pin`).click();
      cy.getTest('app-submenu:group.Pinned:action-button').should('not.exist');
      cy.getTest(`app-submenu:competition.${COMPETITION_UID.PUBLIC}:pin`).click();
      cy.getTest('app-submenu:group.Pinned:action-button').click();
      cy.getTest('app-submenu:group.Pinned:action-button').should('exist');
      cy.getTest('app-submenu:group.Pinned:action-button').click();
      cy.getTest('app-submenu:group.Pinned:action-button').should('not.exist');
      cy.getTest('app-submenu').should('be.visible');
      cy.auth('signOut');
      cy.getTest('app:submenu-button').click();
      cy.getTest('app-submenu').should('not.be.visible');

      // recently viewed
      cy.getTest('app:submenu-button').click();
      cy.getTest('app-submenu').should('be.visible');
      cy.getTest(`app-submenu:competition.${COMPETITION_UID.PUBLIC}`).should('exist');
      cy.getTest('app-submenu:group.Recently Viewed:action-button').click();
      cy.getTest('app-submenu:group.Recently Viewed:action-button').should('exist');
      cy.getTest('app-submenu:group.Recently Viewed:action-button').click();
      cy.getTest('app-submenu:group.Recently Viewed:action-button').should('not.exist');
      cy.getTest('app-submenu').should('be.visible');
      cy.getTest('app:submenu-button').click();
      cy.getTest('app-submenu').should('not.be.visible');
    });

    it('Auth', () => {
      cy.getTest('app:user-menu-button').click();
      cy.getTest('account-buttons:register').click();
      // @TODO: ensure submenu gets closed
      cy.get('.RegisterDialog').should('exist').as('dialog');
      // @TODO: test validation (e.g. submit while empty, submit with existing email)
      cy.get('@dialog').getTest('register-dialog:email-field').find('input').should('be.focused');
      cy.get('@dialog').getTest('register-dialog:email-field').find('input').type(USER_CREDENTIALS.TEST[0]);
      cy.get('@dialog').getTest('register-dialog:password-field').find('input').type(`${USER_CREDENTIALS.TEST[1]}{enter}`);
      // @TODO: ensure no error message
      cy.get('@dialog').should('not.be.visible');
      // @TODO: test switch between Login + Register
      // @TODO: test test forgotten password flow
    });
  });
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

    loginAs(USER_UID.TEST);

    // competition info step
    cy.getTest('submit:step.competition').should('be.visible');
    cy.getTest('submit:step.competition:next').click();
    cy.getTest('submit:step.competition').find('form').as('form');
    cy.get('@form').find(':invalid').should('have.length', 3);
    cy.get('@form').find('input[name=name]').type('Competition Name', { force: true });
    cy.get('@form').find('input[name=date]').type('2020-01-01', { force: true });
    cy.get('@form').find('input[name=location]').type('City, Province', { force: true });
    cy.get('@form').find(':invalid').should('have.length', 0);
    cy.getTest('submit:step.competition:next').click({ force: true });

    // contact info step
    cy.getTest('submit:step.contact').should('be.visible');
    cy.getTest('submit:step.contact:next').click();
    cy.getTest('submit:step.contact').find('form').as('form');
    cy.get('@form').find(':invalid').should('have.length', 3);
    cy.get('@form').find('input[name=name]').type('First Last', { force: true });
    cy.get('@form').find('input[name=email]').type(USER_CREDENTIALS[USER_UID.TEST][0], { force: true });
    cy.get('@form').find('input[name=disclaimer]').check({ force: true });
    cy.get('@form').find(':invalid').should('have.length', 0);
    cy.getTest('submit:step.contact:next').click({ force: true });

    // success + reset
    cy.getTest('submit:submitted').should('be.visible');
    cy.getTest('submit:restart').click({ force: true });
    cy.getTest('submit:step.start').should('not.be.visible');
    cy.getTest('submit:step.competition').should('be.visible');
    cy.getTest('submit:step.contact').should('not.be.visible');
    cy.getTest('submit:submitted').should('not.exist');
    // @TODO: check all carried over fields

    // allow admin's to create competitions directly
    cy.reload();
    cy.getTest('submit:skip').should('not.exist');
    cy.auth('signOut');
    cy.getTest('submit:skip').should('not.exist');
    createUser(USER_UID.ADMIN);
    cy.auth('signInWithEmailAndPassword', USER_CREDENTIALS[USER_UID.ADMIN]);
    cy.getTest('submit:skip').click();
    cy.url().should('match', /competitions\/[^/]+\/admin\/info/);
    cy.getTest('competition:access-state:full').should('exist');
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
  describe('Info', () => {
    it('Redirect from root', () => {
      cy.visit('/#/admin');
      cy.url().should('contain', '/#/admin/info/versions');
    });
    it('Redirect from subsection', () => {
      cy.visit('/#/admin/info');
      cy.url().should('contain', '/#/admin/info/versions');
    });
    it('Versions', () => {
      const versions = {
        web: '1.2.3',
        ios: '4.5.6',
        android: '7.8.9',
      };
      seed.database.set('development/versions', versions);

      cy.visit('/#/admin/info/versions');
      itShouldBeAuthGuarded(true);

      Object.entries(versions).forEach(([name, version]) => {
        cy.get(`input[name="${name}"]`).should('have.value', version);
      });
    });
    it('FAQs', () => {
      const faqs = [{ question: 'Foo', answer: 'Bar' }, { question: 'Baz', answer: 'Quux' }];
      seed.database.set('development/faqs', faqs);

      cy.visit('/#/admin/info/faqs');
      itShouldBeAuthGuarded(true);

      const text = faqs.reduce((acc, { question, answer }) => `${acc}${question}${answer}`, '');
      cy.get('table.htCore tbody tr td').should('have.text', text);
    });
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
