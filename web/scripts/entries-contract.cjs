const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
// This test uses only local emulators and never changes the Entries sample stub.
const entries = path.resolve(process.env.ENTRIES_TEST_REPOSITORY || path.resolve(__dirname, '../../../entries'), 'functions');
const env = fs.readFileSync(entries + '/.secret.local', 'utf8');
const secret = env.split('\n').find(x => x.startsWith('TOOL_PASS_SECRET=')).slice('TOOL_PASS_SECRET='.length).trim().replace(/^['"]|['"]$/g, '');
process.env.SCOTDANCE_ENTRIES_URL = 'http://127.0.0.1:5001/firebase-scotdance/us-central1/entriesCompetition';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8380';
const { scotDanceSource } = require(entries + '/dist/entryService.js');
const entriesRequire = require('node:module').createRequire(entries + '/dist/entryService.js');
const { initializeApp } = entriesRequire('firebase-admin/app');
const { getFirestore } = entriesRequire('firebase-admin/firestore');
const firestore = getFirestore(initializeApp({ projectId: process.env.ENTRIES_TEST_PROJECT || 'demo-entries' }, 'contract-test'));
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
  await firestore.doc(`users/${uid}`).set({ email: 'contract@example.test', name: 'Contract organiser' });
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
  await source(uid, org, comp, 'registration', registration);
  assert.equal((await db('GET', `competitions/${comp}/entriesRegistration`)).revision, 1);
  console.log('PASS signed registration transaction persisted managed ownership');
  const marker = { competitionId: comp, organisationId: org, targetId: main, revision: 1 };
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
   [`entries:membershipVersions/${org}`]: null,
  });
  await firestore.recursiveDelete(firestore.doc(`organisations/${org}`));
  await firestore.doc(`users/${uid}`).delete();
 }
})().then(() => { console.log('PASS isolated fixture cleanup'); process.exit(0); }, error => { console.error(error.message); process.exit(1); });
