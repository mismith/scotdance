import { initializeApp, database as adminDB } from 'firebase-admin';
import { config, database as functionsDB } from 'firebase-functions';
import Invites from './invites';
import Submissions from './submissions';

function initEnv(env) {
  const instance = env === 'development' ? 'scotdance-dev' : 'scotdance';
  const app = initializeApp(
    {
      databaseURL: `https://${instance}.firebaseio.com`,
    },
    env,
  );

  return {
    env,
    app,
    instance,
    db: adminDB(app).ref(env),
    database: functionsDB.instance(instance),
    name: 'ScotDance.app',
    description: 'Highland dancing event tracker',
    email: 'admin@scotdance.app',
    url: env === 'development' ? 'http://localhost:8080' : 'https://scotdance.app',
  };
}

const env = config().app.env || 'production';
const appConfig = initEnv(env);

const invites = new Invites(appConfig.database, appConfig);
const invitesHooks = invites.hook(`/${env}/competitions:data/{competitionId}/invites`);
export const competitionInviteCreated = invitesHooks.onCreate;
export const competitionInviteUpdated = invitesHooks.onUpdate;
export const competitionInviteDeleted = invitesHooks.onDelete;

const submissions = new Submissions(appConfig.database, appConfig);
const submissionsHooks = submissions.hook(`/${env}/competitions:submissions`);
export const competitionSubmissionCreated = submissionsHooks.onCreate;
export const competitionSubmissionUpdated = submissionsHooks.onUpdate;

// const appConfig2 = initEnv('development');
// const submissions2 = new Submissions(appConfig2.database, appConfig2);
// const submissionsHooks2 = submissions2.hook(`/${appConfig2.env}/competitions:submissions`);
// export const competitionSubmissionCreated2 = submissionsHooks2.onCreate;
// export const competitionSubmissionUpdated2 = submissionsHooks2.onUpdate;
