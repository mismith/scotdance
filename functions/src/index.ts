import { initializeApp, database as adminDB } from 'firebase-admin';
import { config, database as functionsDB } from 'firebase-functions';
import Invites from './invites';
import Submissions from './submissions';

const env = config().app.env || 'production';
const instance = env === 'development' ? 'scotdance-dev' : 'scotdance';
initializeApp({
  databaseURL: `https://${instance}.firebaseio.com`,
});

const db = adminDB().ref(env);
const database = functionsDB.instance(instance);
const appConfig = {
  env,
  db,
  database,
  name: 'ScotDance.app',
  description: 'Highland dancing event tracker',
  email: 'admin@scotdance.app',
  url: env === 'development' ? 'http://localhost:8080' : 'https://scotdance.app',
};

const invites = new Invites(database, appConfig);
const invitesHooks = invites.hook(`/${env}/competitions:data/{competitionId}/invites`);
export const competitionInviteCreated = invitesHooks.onCreate;
export const competitionInviteUpdated = invitesHooks.onUpdate;
export const competitionInviteDeleted = invitesHooks.onDelete;

const submissions = new Submissions(database, appConfig);
const submissionsHooks = submissions.hook(`/${env}/competitions:submissions`);
export const competitionSubmissionCreated = submissionsHooks.onCreate;
export const competitionSubmissionUpdated = submissionsHooks.onUpdate;
