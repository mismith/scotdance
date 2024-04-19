import 'cypress-file-upload';

import { firebase } from '../../src/helpers/firebase';

Cypress.Commands.add('getTest', { prevSubject: 'optional' }, (subject, id, options = {}) => {
  return cy.get(`[data-test-id="${id}"]`, {
    withinSubject: subject,
    ...options,
  });
});

Cypress.Commands.add('auth', (method, args = []) => {
  return cy.wrap(firebase.auth()[method]?.(...args));
});
