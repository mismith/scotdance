import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTRIES_AUDIENCE, ENTRIES_ISSUER, getOnEntriesCompetition, signEntriesMessage } from './entriesBridge';

function world(cold = false, staleEmpty = false) {
  const event: Record<string, any> = { name: 'Games', date: '2027-06-12', registrationURL: `${ENTRIES_ISSUER}/enter/org/comp`, registrationStart: 100, registrationEnd: 200,
    entriesRegistration: { competitionId: 'comp', organisationId: 'org', targetId: 'comp', bindingId: 'binding', revision: 1 } };
  const records: Record<string, any> = {
    'competitions/comp': event, 'organisations/org': { name: 'Org' },
    'users:permissions/admin/competitions/comp': true, 'organisations:permissions/org/users/admin': true,
  };
  const db = { child: (path: string) => ({
    get: async () => ({ val: () => records[path] ?? null }),
    transaction: async (fn: (value: any) => any) => {
      if (cold) assert.equal(fn(null), null, 'A cold cache must allow the server retry');
      if (staleEmpty) assert.ok(fn({ name: 'Games', date: '2027-06-12' }), 'Cached absence must be checked by the server');
      const next = fn(structuredClone(records[path]));
      if (next !== undefined) records[path] = next;
      return { committed: next !== undefined, snapshot: { exists: () => !!records[path], val: () => records[path] } };
    },
  }) };
  const handle = getOnEntriesCompetition(() => 'test-secret', db);
  const call = (extra = {}) => handle({ pass: signEntriesMessage('test-secret', {
    iss: ENTRIES_ISSUER, aud: ENTRIES_AUDIENCE, sub: 'admin', action: 'release',
    organisationId: 'org', competitionId: 'comp', bindingId: 'binding', targetId: 'comp', ...extra,
  }) });
  return { records, call };
}

test('disconnect clears only Entries registration and preserves the original event; retries are safe', async () => {
  const w = world();
  await w.call(); await w.call();
  assert.deepEqual(w.records['competitions/comp'], { name: 'Games', date: '2027-06-12' });
});
test('disconnect preserves a replacement external registration URL and its dates', async () => {
  const w = world(); w.records['competitions/comp'].registrationURL = 'https://other.example/enter';
  await w.call();
  assert.equal(w.records['competitions/comp'].registrationURL, 'https://other.example/enter');
  assert.equal(w.records['competitions/comp'].registrationStart, 100);
  assert.equal(w.records['competitions/comp'].entriesRegistration, undefined);
});
test('disconnect rejects wrong bindings and non-admins without altering registration', async () => {
  const w = world();
  await assert.rejects(w.call({ bindingId: 'stale' }), /connection changed/);
  await assert.rejects(w.call({ sub: 'stranger' }), /administer/);
  assert.equal(w.records['competitions/comp'].entriesRegistration.bindingId, 'binding');
});
test('late publication with the released binding cannot restore the registration link', async () => {
  const w = world(); await w.call();
  await assert.rejects(w.call({ action: 'registration', sub: 'entries-service', authority: 'service', revision: 2,
    registrationURL: `${ENTRIES_ISSUER}/enter/org/comp`, registrationStart: 100, registrationEnd: 200 }), /no longer authorised/);
  assert.equal(w.records['competitions/comp'].registrationURL, undefined);
});

test('disconnect retries a cold local cache against the source event', async () => {
  const w = world(true); await w.call();
  assert.equal(w.records['competitions/comp'].entriesRegistration, undefined);
  assert.equal(w.records['competitions/comp'].name, 'Games');
});


test('a late refresh cannot reclaim a released binding', async () => {
  const w = world(); await w.call();
  await assert.rejects(w.call({ action: 'claim', expectedBindingId: 'binding' }), /removed or replaced/);
  assert.equal(w.records['competitions/comp'].entriesRegistration, undefined);
  await w.call({ action: 'claim' });
  assert.ok(w.records['competitions/comp'].entriesRegistration.bindingId);
});
test('an organisation admin can remove Entries after the original competition was deleted', async () => {
  const w = world(); delete w.records['competitions/comp'];
  await w.call();
  assert.equal(w.records['competitions/comp'], null);
  await assert.rejects(w.call({ sub: 'stranger' }), /administer/);
});

test('disconnect verifies a stale no-owner cache against the actual registration', async () => {
  const w = world(false, true); await w.call();
  assert.equal(w.records['competitions/comp'].entriesRegistration, undefined);
  assert.equal(w.records['competitions/comp'].registrationURL, undefined);
});


test('Entries snapshots include the actual organisation short name and its removal', async () => {
  const w = world(); w.records['organisations/org'].shortName = ' FHDA ';
  const named = await w.call({ action: 'snapshot' }); assert.ok('organisation' in named);
  assert.equal(named.organisation.shortName, 'FHDA');
  delete w.records['organisations/org'].shortName;
  const cleared = await w.call({ action: 'snapshot' }); assert.ok('organisation' in cleared);
  assert.equal(cleared.organisation.shortName, null);
});
