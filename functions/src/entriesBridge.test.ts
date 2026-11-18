import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTRIES_ISSUER, ENTRIES_URLS, getOnEntriesCompetition } from './entriesBridge';
import { SERVICES, serviceToken } from './service';

// Service proofs on the emulator are signed with the fixed emulator key, so the receiver must run as on the emulator.
process.env.FUNCTIONS_EMULATOR = 'true';

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
  const handle = getOnEntriesCompetition(db);
  const call = async ({ sub = 'admin', ...extra }: Record<string, unknown> = {}) => handle({ uid: sub, action: 'release',
    organisationId: 'org', competitionId: 'comp', bindingId: 'binding', targetId: 'comp', ...extra,
    service: await serviceToken(ENTRIES_URLS.bridge, SERVICES.entries, true) });
  const callAs = async (self: string, extra = {}) => handle({ uid: 'admin', action: 'release', organisationId: 'org', competitionId: 'comp',
    bindingId: 'binding', targetId: 'comp', ...extra, service: await serviceToken(ENTRIES_URLS.bridge, self, true) });
  return { records, call, callAs, handle };
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
test('disconnect clears the event page link Entries publishes now', async () => {
  const w = world(); w.records['competitions/comp'].registrationURL = `${ENTRIES_ISSUER}/info/org/comp`;
  await w.call();
  assert.deepEqual(w.records['competitions/comp'], { name: 'Games', date: '2027-06-12' });
});
test('disconnect leaves another competition\'s Entries link and other Entries pages alone', async () => {
  for (const url of [`${ENTRIES_ISSUER}/info/org/other`, `${ENTRIES_ISSUER}/enter/other/comp`, `${ENTRIES_ISSUER}/organise/org/comp`, `${ENTRIES_ISSUER}/info/org/comp?next=1`]) {
    const w = world(); w.records['competitions/comp'].registrationURL = url;
    await w.call();
    assert.equal(w.records['competitions/comp'].registrationURL, url);
    assert.equal(w.records['competitions/comp'].registrationEnd, 200);
    assert.equal(w.records['competitions/comp'].entriesRegistration, undefined);
  }
});
test('publication accepts the event page and the older entry form, and no other link', async () => {
  const publish = (w: ReturnType<typeof world>, revision: number, registrationURL: string) => w.call({ action: 'registration',
    sub: 'entries-service', authority: 'service', revision, registrationURL, registrationStart: 100, registrationEnd: 200 });
  const w = world();
  assert.equal((await publish(w, 2, `${ENTRIES_ISSUER}/info/org/comp`) as any).applied, true);
  assert.equal(w.records['competitions/comp'].registrationURL, `${ENTRIES_ISSUER}/info/org/comp`);
  assert.equal((await publish(w, 3, `${ENTRIES_ISSUER}/enter/org/comp`) as any).applied, true);
  assert.equal(w.records['competitions/comp'].registrationURL, `${ENTRIES_ISSUER}/enter/org/comp`);
  for (const url of ['/organise/org/comp', '/info/org/other', '/info/other/comp', '/info/org/comp/extra', '/info/org', '/info/org/comp?x=1', '/info/org/comp#x', '/INFO/org/comp']) {
    await assert.rejects(publish(w, 4, `${ENTRIES_ISSUER}${url}`), /must link to ScotDance Entries/, url);
  }
  for (const url of ['https://evil.test/info/org/comp', 'http://entries.scotdance.app/info/org/comp', 'https://user@entries.scotdance.app/info/org/comp', 'https://localhost:5290/info/org/comp']) {
    await assert.rejects(publish(w, 4, url), /must link to ScotDance Entries/, url);
  }
  assert.equal(w.records['competitions/comp'].entriesRegistration.revision, 3);
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

test('the development account only reads, and an unknown account is refused', async () => {
  const w = world();
  assert.equal(((await w.callAs(SERVICES.entriesDevelopment, { action: 'snapshot' })) as any).competition.id, 'comp');
  await assert.rejects(w.callAs(SERVICES.entriesDevelopment), /may only read/);
  assert.ok(w.records['competitions/comp'].entriesRegistration);
  await assert.rejects(w.callAs('other@example.com'), /invalid or expired/);
  await assert.rejects(w.handle({ uid: 'admin', action: 'release', organisationId: 'org', competitionId: 'comp', bindingId: 'binding' }), /invalid or expired/);
  await assert.rejects(w.handle({ uid: 'admin', action: 'release', service: 'garbage' }), /invalid or expired/);
  await w.callAs(SERVICES.entries);
  assert.equal(w.records['competitions/comp'].entriesRegistration, undefined);
});
