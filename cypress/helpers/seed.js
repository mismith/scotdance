function auth(method, ...args) {
  return cy.task('firebase-admin:auth', { method, args });
}
function database(method, ...args) {
  return cy.task('firebase-admin:database', { method, args });
}

auth.createUser = (
  {
    uid,
    email,
    password,
    displayName = null,
  },
  isAdmin = false,
) => {
  auth('createUser', { uid, email, password }).then(() => {
    database.set(`development/users/${uid}`, { email, displayName });
    if (isAdmin) {
      database.set(`development/users:permissions/${uid}/admin`, true);
    }
  });
};

database.get = (path, ...others) => {
  return database('get', path, ...others);
};
database.set = (path, value, ...others) => {
  return database('set', path, value, ...others);
};

export default {
  auth,
  database,
  reset() {
    auth('resetUsers');
    database.set('development', null);
  },
};
