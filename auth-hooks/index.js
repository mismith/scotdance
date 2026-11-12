const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { runWith } = require('firebase-functions/v1');
const { queueAccountDeletion } = require('./deletion');

// Auth deletion remains first-generation, whose supported Node runtime is 22.
// This hook only queues work; the main Node 24 codebase signs and delivers it.
const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
const databaseURL = emulator
  ? `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/?ns=scotdance`
  : 'https://scotdance.firebaseio.com';
const app = initializeApp({ databaseURL }, 'entries-auth-deletion');
const namespace = emulator ? 'development' : 'production';

exports.entriesAccountDeleted = runWith({ failurePolicy: true, maxInstances: 2 })
  .auth.user().onDelete(async (user) => {
    await queueAccountDeletion(getDatabase(app).ref(namespace), user.uid);
  });
