import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { getOnToolPass } = require('../dist/functions/src/toolPass.js');
const db = { child: () => ({ get: async () => ({ val: () => null }), update: async () => {} }) };
const handler = getOnToolPass(() => 'test-only-secret', db);
const decode = (pass) => JSON.parse(Buffer.from(pass.split('.')[1], 'base64url'));

test('email verification comes only from the authenticated Firebase claim', async () => {
  for (const verified of [true, false, undefined, 'true']) {
    const result = await handler({ audience: 'entries', emailVerified: true }, {
      auth: { uid: 'alex', token: { email: 'alex@example.com', email_verified: verified } },
    });
    const claims = decode(result.pass);
    assert.equal(claims.emailVerified, verified === true);
    assert.equal(claims.email, 'alex@example.com');
  }
});

test('Binder receives verification too; anonymous accounts cannot mint passes', async () => {
  const result = await handler({ audience: 'binder' }, {
    auth: { uid: 'alex', token: { email: 'alex@example.com', email_verified: true } },
  });
  assert.equal(decode(result.pass).emailVerified, true);
  await assert.rejects(handler({ audience: 'binder' }, {
    auth: { uid: 'alex', token: { email_verified: true, firebase: { sign_in_provider: 'anonymous' } } },
  }), { code: 'unauthenticated' });
});


test('Entries receives the actual organisation short name, including explicit absence', async () => {
  const records = {
    'users:permissions/alex/organisations': { named: true, unnamed: true },
    'organisations/named': { name: 'Foothills Highland Dancing Association', shortName: ' FHDA ' },
    'organisations/unnamed': { name: 'An Organisation Without a Short Name' },
  };
  const source = { child: path => ({ get: async () => ({ val: () => records[path] ?? null }), update: async () => {} }) };
  const result = await getOnToolPass(() => 'test-only-secret', source)({ audience: 'entries' }, {
    auth: { uid: 'alex', token: { email: 'alex@example.com' } },
  });
  assert.deepEqual(decode(result.pass).organisations, [
    { id: 'named', name: 'Foothills Highland Dancing Association', shortName: 'FHDA' },
    { id: 'unnamed', name: 'An Organisation Without a Short Name', shortName: null },
  ]);
});
