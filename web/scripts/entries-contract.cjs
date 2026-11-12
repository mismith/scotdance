const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
// This test uses only local emulators and never changes the Entries sample stub.
const entries = path.resolve(process.env.ENTRIES_TEST_REPOSITORY || path.resolve(__dirname, '../../../entries'), 'functions');
const env = fs.readFileSync(entries + '/.secret.local', 'utf8');
const secret = env.split('\n').find(x => x.startsWith('TOOL_PASS_SECRET=')).slice('TOOL_PASS_SECRET='.length).trim().replace(/^['"]|['"]$/g, '');
process.env.SCOTDANCE_ENTRIES_URL = 'http://127.0.0.1:5001/firebase-scotdance/us-central1/entriesCompetition';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8380';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9399';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9009';
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = 'firebase-scotdance';
const { scotDanceSource } = require(entries + '/dist/entryService.js');
const entriesRequire = require('node:module').createRequire(entries + '/dist/entryService.js');
const { initializeApp } = entriesRequire('firebase-admin/app');
const { getFirestore } = entriesRequire('firebase-admin/firestore');
const project = process.env.ENTRIES_TEST_PROJECT || 'demo-entries';
const entriesApp = initializeApp({ projectId: project }, 'contract-test');
const firestore = getFirestore(entriesApp);
const auth = entriesRequire('firebase-admin/auth').getAuth(entriesApp);
const sourceDb = entriesRequire('firebase-admin/database').getDatabase(initializeApp({ projectId: 'firebase-scotdance', databaseURL: 'http://127.0.0.1:9009/?ns=scotdance' }, 'contract-source')).ref('development');
const deletionHook = require('../../auth-hooks').entriesAccountDeleted;
const { sendEntriesAccountDeletion } = require('../../functions/dist/functions/src/entriesBridge');
const source = scotDanceSource(() => secret, true);
const id = 'contract-' + require('node:crypto').randomUUID();
const uid = id + '-user', org = id + '-org', comp = id + '-sat', main = id + '-sun', link = id + '-link';
async function db(method, relative, data) {
 const response = await fetch('http://127.0.0.1:9009/development/' + relative + '.json?ns=scotdance', {
  method, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data),
 });
 if (!response.ok) throw Error('Database status ' + response.status);
 return response.json();
}
async function membership(allowed) {
 const stop = Date.now() + 25000;
 while (Date.now() < stop) {
  const state = await firestore.doc(`organisations/${org}/membershipState/${uid}`).get();
  const member = await firestore.doc(`organisations/${org}/members/${uid}`).get();
  if (state.data()?.allowed === allowed && member.exists === allowed) return state.data();
  await new Promise(resolve => setTimeout(resolve, 400));
 }
 throw Error('Membership trigger did not reach Entries state ' + allowed);
}
(async () => {
 try {
  await firestore.doc(`users/${uid}`).set({ email: '', name: 'Contract organiser' });
  await auth.createUser({ uid });
  await db('PATCH', '', {
   [`competitions/${comp}`]: { name: 'Isolated Entries contract Saturday', date: '2027-07-05', listed: false },
   [`competitions/${main}`]: { name: 'Isolated Entries contract Sunday', date: '2027-07-06', listed: false },
   [`organisations/${org}`]: { name: 'Isolated contract association', image: 'https://example.test/logo.png' },
   [`users:permissions/${uid}`]: { competitions: { [comp]: true, [main]: true } },
   [`organisations:permissions/${org}/users/${uid}`]: true,
  });
  const inspected = await source(uid, org, comp, 'inspect');
  assert.equal(inspected.registrationTargetId, comp);
  assert.equal(inspected.organisation.image, 'https://example.test/logo.png');
  console.log('PASS actual Entries signer -> ScotDance inspect and public snapshot');
  const registration = { registrationURL: `http://localhost:5290/enter/${org}/${comp}`, registrationStart: 1800000000000, registrationEnd: 1800100000000, revision: 1 };
  const claimed = await source(uid, org, comp, 'claim');
  await db('DELETE', `users:permissions/${uid}`);
  await assert.rejects(() => source(uid, org, comp, 'registration', registration));
  await source('entries-service', org, comp, 'registration', { ...registration, authority: 'service', bindingId: claimed.bindingId });
  await db('PUT', `users:permissions/${uid}`, { competitions: { [comp]: true, [main]: true } });
  console.log('PASS claimed service publishes after the original human editor loses access');
  assert.equal((await db('GET', `competitions/${comp}/entriesRegistration`)).revision, 1);
  console.log('PASS signed registration transaction persisted managed ownership');
  const marker = { competitionId: comp, organisationId: org, targetId: main, revision: 1, bindingId: claimed.bindingId };
  await db('PATCH', '', {
   [`competitionLinks/${link}`]: { primary: main, competitions: { [comp]: true, [main]: true } },
   [`competitionLinks:of/${comp}`]: link, [`competitionLinks:of/${main}`]: link,
   [`competitionLinks:sync/${comp}/registration`]: true,
   [`competitions/${comp}/entriesRegistration`]: marker,
   [`competitions/${main}/entriesRegistration`]: marker,
  });
  assert.equal((await source(uid, org, comp, 'inspect')).registrationTargetId, main);
  await source(uid, org, comp, 'registration', { ...registration, revision: 2 });
  assert.equal((await db('GET', `competitions/${main}/entriesRegistration`)).revision, 2);
  console.log('PASS shared registration resolved and persisted on primary');
  const dances = [{ name: 'Highland Fling', steps: '4' }, { name: 'Highland Fling', steps: '4' }, { name: 'Sword Dance', steps: '2+1' }];
  await source(uid, org, comp, 'dances', { dances });
  assert.equal(Object.keys(await db('GET', `competitions:data/${comp}/dances`)).length, 2);
  await assert.rejects(() => source(uid, org, comp, 'dances', { dances }));
  console.log('PASS atomic deduplicated dance seed and second-send refusal');
  const granted = await membership(true);
  await db('DELETE', `organisations:permissions/${org}/users/${uid}`);
  const removed = await membership(false);
  assert(removed.checkedAt > granted.checkedAt);
  await assert.rejects(() => source(uid, org, comp, 'inspect'));
  console.log('PASS source grant/removal triggers -> Entries membership receiver; removed editor refused');
  await db('PUT', `organisations:permissions/${org}/users/${uid}`, true);
  await membership(true);
  await source(uid, org, comp, 'unlink', { bindingId: claimed.bindingId });
  await source(uid, org, comp, 'unlink', { bindingId: claimed.bindingId });
  assert.equal(await db('GET', `competitions/${main}/entriesRegistration`), null);
  await assert.rejects(() => source('entries-service', org, comp, 'registration', { ...registration, revision: 3, authority: 'service', bindingId: claimed.bindingId }));
  const nextClaim = await source(uid, org, comp, 'claim');
  assert.notEqual(nextClaim.bindingId, claimed.bindingId);
  await assert.rejects(() => source(uid, org, comp, 'unlink', { bindingId: claimed.bindingId }));
  console.log('PASS idempotent unlink and stale binding refusal after reconnecting');
  const dancer = { firstName: 'Ava', lastName: 'Ross', birthday: '2016-12-20', category: 'Beginner', studio: 'Thistle', registrationNumber: '1234' };
  await firestore.doc(`users/${uid}/dancers/ava`).set(dancer);
  await firestore.doc(`organisations/${org}/orders/privacy-test`).set({ uid, email: null, competition: comp, date: '2027-07-05', status: 'paid', total: 1200, currency: 'cad', paidAt: Date.now(), participants: [{ dancerId: 'ava', dancer, items: [{ id: 'fling', name: 'Fling', kind: 'dance', price: 1200 }], fees: [], refundAmount: 1200 }] });
  // Exercise the actual Auth hook handler and Node24 delivery helper. The emulators can be
  // running before the newly added auth-hooks codebase is registered, so invoke the event handler directly.
  await deletionHook.run({ uid });
  await sendEntriesAccountDeletion(sourceDb, secret, `http://127.0.0.1:5201/${project}/us-central1/deleteScotDanceAccount`, uid);
  assert.equal((await db('GET', `entries:accountDeletions/${uid}`)).state, 'complete');
  assert.equal((await firestore.doc(`users/${uid}`).get()).exists, false);
  assert.equal((await firestore.doc(`users/${uid}/dancers/ava`).get()).exists, false);
  const retained = (await firestore.doc(`organisations/${org}/orders/privacy-test`).get()).data();
  assert.equal(retained.participants[0].dancer.birthday, undefined);
  assert.equal(retained.participants[0].dancer.ageAtCompetition, 10);
  assert.equal(retained.participants[0].dancer.firstName, 'Ava');
  assert.equal(retained.total, 1200);
  await assert.rejects(() => auth.getUser(uid));
  console.log('PASS real Auth deletion handler -> durable queue -> signed Entries receiver; private profile removed and paid roster kept');
 } finally {
  await db('DELETE', `organisations:permissions/${org}/users/${uid}`);
  await membership(false).catch(() => console.warn('Membership cleanup was not acknowledged by the local receiver.'));
  await db('PATCH', '', {
   [`competitions/${comp}`]: null, [`competitions/${main}`]: null,
   [`competitions:data/${comp}`]: null, [`competitions:data/${main}`]: null,
   [`organisations/${org}`]: null, [`organisations:permissions/${org}`]: null,
   [`users:permissions/${uid}`]: null, [`competitionLinks/${link}`]: null,
   [`competitionLinks:of/${comp}`]: null, [`competitionLinks:of/${main}`]: null,
   [`competitionLinks:sync/${comp}`]: null, [`entries:membershipFailures/${org}`]: null,
   [`entries:membershipVersions/${org}`]: null, [`entries:accountDeletions/${uid}`]: null,
  });
  await firestore.recursiveDelete(firestore.doc(`organisations/${org}`));
  await firestore.recursiveDelete(firestore.doc(`users/${uid}`));
  await firestore.doc(`deletedAccounts/${uid}`).delete();
  await auth.deleteUser(uid).catch(() => {});
 }
})().then(() => { console.log('PASS isolated fixture cleanup'); process.exit(0); }, error => { console.error(error.message); process.exit(1); });
