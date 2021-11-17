import { firebase } from '../../src/helpers/firebase';

Cypress.Commands.add('getTest', (id) => {
  return cy.get(`[data-test-id="${id}"]`);
});

Cypress.Commands.add('auth', (method, args = []) => {
  return firebase.auth()[method]?.(...args);
});
