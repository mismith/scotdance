function auth(method, ...args) {
  return cy.task('firebase-admin:auth', { method, args });
}
function database(method, ...args) {
  return cy.task('firebase-admin:database', { method, args });
}

auth.createUser = (data, isAdmin = false) => {
  auth('createUser', data).then(({ uid }) => {
    if (isAdmin) {
      database.set(`development/users:permissions/${uid}/admin`, true);
    }
  });
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
