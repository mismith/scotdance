import 'cypress-file-upload';
import * as auth from 'firebase/auth';

import '../../src/helpers/firebase'; // import in order to init firebase app within cy context

Cypress.Commands.add('getTest', (id) => {
  return cy.get(`[data-test-id="${id}"]`);
});

Cypress.Commands.add('auth', (method, args = []) => {
  return cy.wrap(auth[method]?.(auth.getAuth(), ...args));
});
