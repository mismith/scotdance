const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
// const { getStorage } = require('firebase-admin/storage');

// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config

  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
  // process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  initializeApp({
    projectId: 'firebase-scotdance',
    databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=scotdance-cypress`,
  });

  on('task', {
    'firebase-admin:auth': async ({ method, args = [] }) => {
      const auth = getAuth();
      let result;
      switch (method) {
        case 'resetUsers': {
          const { users } = await auth.listUsers(100); // @TODO: split into batches
          result = await auth.deleteUsers(users.map((user) => user.uid));
          break;
        }
        default: {
          result = await auth[method](...args);
          break;
        }
      }
      return result === undefined ? null : result;
    },
    'firebase-admin:database': async ({ method, args = [] }) => {
      const database = getDatabase();
      let result;
      switch (method) {
        case 'get':
        case 'set': {
          result = await database.ref(args[0])[method](...args.slice(1));
          break;
        }
        default: {
          result = await database[method](...args);
          break;
        }
      }
      return result === undefined ? null : result;
    },
  });
};
