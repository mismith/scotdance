import { createHash, timingSafeEqual } from 'node:crypto';
import { InvalidGrantError, InvalidScopeError, InvalidTargetError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { resource as resourceUrl } from '../mcp/config';
import {
  ACCESS_TTL,
  REFRESH_GRACE,
  REFRESH_TTL,
  SCOPE,
  connectionPath,
  expired,
  later,
  sha256,
  str,
} from './common';
import { endConnection } from './connections';
import { getStore, randomToken, runtime } from './runtime';
import { KEEP, type Doc } from './store';

/** Codes, access tokens and refresh tokens: made, swapped, ended (ADR 0018) */

const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

const sha256Base64Url = (text: string) => createHash('sha256').update(text).digest('base64url');

/** Does this code_verifier make this S256 challenge? Compared in constant time. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier)) return false;
  const made = Buffer.from(sha256Base64Url(verifier));
  const want = Buffer.from(challenge);
  return made.length === want.length && timingSafeEqual(made, want);
}

/** The trailing slash makes no difference to which address a resource is */
export const trimSlash = (href: string) => href.replace(/\/+$/, '');

interface Subject {
  connection: string;
  uid: string;
  clientId: string;
  clientName: string;
  /** The address the tokens are for (the OAuth `resource`) */
  resource: string;
}

/**
 * A fresh access + refresh pair, and the connection marked used. Written one record at a time (the database has no
 * transaction across them), so after writing it checks the connection is still there: one ended meanwhile takes
 * these tokens with it.
 */
async function issue(subject: Subject): Promise<OAuthTokens> {
  const store = getStore();
  const access = randomToken();
  const refresh = randomToken();
  const base = { ...subject, scope: SCOPE };
  await Promise.all([
    store.set(`oauth:tokens/${sha256(access)}`, { ...base, expiresAt: later(ACCESS_TTL) }),
    store.set(`oauth:refresh/${sha256(refresh)}`, { ...base, expiresAt: later(REFRESH_TTL) }),
  ]);
  const path = connectionPath(subject.uid, subject.connection);
  const { after } = await store.update(path, (record) => (record ? { ...record, lastUsedAt: runtime.now() } : KEEP));
  if (!after) {
    await store.deleteAll([`oauth:tokens/${sha256(access)}`, `oauth:refresh/${sha256(refresh)}`]);
    throw new InvalidGrantError('That connection has ended');
  }
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL / 1000,
    refresh_token: refresh,
    scope: SCOPE,
  };
}

type Outcome = { ok: Doc } | { fail: true } | { replay: { uid: string; connection: string } } | { error: Error };

/** The client's name, kept on the connection record when it was made */
async function clientName(uid: string, connection: string): Promise<string | undefined> {
  const record = await getStore().get(connectionPath(uid, connection));
  if (!record) return undefined;
  return str((record.client ?? {}) as Doc, 'name');
}

/**
 * Swap a code for tokens. The code is marked used by the very first look at it, whatever follows, so a wrong
 * guess burns it; a code seen twice means someone has it who shouldn't, so the connection it made ends.
 */
export async function exchangeCode(
  clientId: string,
  code: string,
  verifier: string | undefined,
  redirectUri: string | undefined,
  resource: URL | undefined,
): Promise<OAuthTokens> {
  const path = `oauth:codes/${sha256(code)}`;
  let outcome = { fail: true } as Outcome;
  await getStore().update(path, (doc) => {
    if (!doc) {
      outcome = { fail: true };
      return KEEP;
    }
    if (doc.usedAt) {
      outcome = { replay: { uid: str(doc, 'uid'), connection: str(doc, 'connection') } };
      return KEEP;
    }
    const good = doc.scope === SCOPE
      && !expired(doc)
      && doc.clientId === clientId
      && !!redirectUri
      && doc.redirectUri === redirectUri
      && !(resource && trimSlash(resource.href) !== doc.resource)
      && !!verifier
      && pkceMatches(verifier, str(doc, 'codeChallenge'));
    outcome = good ? { ok: doc } : { fail: true };
    return { ...doc, usedAt: runtime.now() };
  });
  if ('replay' in outcome) {
    await endConnection(outcome.replay.uid, outcome.replay.connection);
    throw new InvalidGrantError('That code has already been used');
  }
  if (!('ok' in outcome)) throw new InvalidGrantError('That code is not valid');
  const doc = outcome.ok;
  const uid = str(doc, 'uid');
  const connection = str(doc, 'connection');
  const name = await clientName(uid, connection);
  if (name === undefined) throw new InvalidGrantError('That code is not valid');
  return issue({
    connection,
    uid,
    clientId,
    clientName: name,
    resource: str(doc, 'resource') || resourceUrl(),
  });
}

/** The asked-for scopes can only shrink what was granted; there is one scope, so they can only name it */
function checkScopes(asked: string[] | undefined): void {
  for (const s of asked ?? []) if (s !== '' && s !== SCOPE) throw new InvalidScopeError('That scope was not granted');
}

/**
 * Swap a refresh token for a new pair. Each is good once; one seen again was copied, so the connection ends,
 * unless it comes straight back from the same client (REFRESH_GRACE).
 */
export async function exchangeRefresh(
  clientId: string,
  token: string,
  scopes: string[] | undefined,
  resource: URL | undefined,
): Promise<OAuthTokens> {
  checkScopes(scopes);
  const path = `oauth:refresh/${sha256(token)}`;
  let outcome = { fail: true } as Outcome;
  await getStore().update(path, (doc) => {
    if (!doc || doc.clientId !== clientId || expired(doc)) {
      outcome = { fail: true };
      return KEEP;
    }
    if (doc.usedAt) {
      // The same client again within moments: its response probably never arrived. Refuse this one, but the
      // pair it was given is still good, so don't end the connection. Later than that, someone copied it.
      const first = typeof doc.usedAt === 'number' ? doc.usedAt : 0;
      outcome = runtime.now() - first < REFRESH_GRACE
        ? { fail: true }
        : { replay: { uid: str(doc, 'uid'), connection: str(doc, 'connection') } };
      return KEEP;
    }
    // Checked before it is marked used, so a wrong resource doesn't burn the token
    if (resource && trimSlash(resource.href) !== (str(doc, 'resource') || resourceUrl())) {
      outcome = { error: new InvalidTargetError('That is not the resource these tokens are for') };
      return KEEP;
    }
    outcome = doc.scope === SCOPE ? { ok: doc } : { fail: true };
    return { ...doc, usedAt: runtime.now() };
  });
  if ('error' in outcome) throw outcome.error;
  if ('replay' in outcome) {
    await endConnection(outcome.replay.uid, outcome.replay.connection);
    throw new InvalidGrantError('That refresh token has already been used');
  }
  if (!('ok' in outcome)) throw new InvalidGrantError('That refresh token is not valid');
  const doc = outcome.ok;
  const uid = str(doc, 'uid');
  const connection = str(doc, 'connection');
  const name = await clientName(uid, connection);
  // A connection that was ended meanwhile has no record: its refresh token is spent for nothing
  if (name === undefined) throw new InvalidGrantError('That refresh token is not valid');
  return issue({ connection, uid, clientId, clientName: name, resource: str(doc, 'resource') || resourceUrl() });
}

/** RFC 7009: a refresh or access token from this client ends its connection. Anything else does nothing. */
export async function revoke(clientId: string, token: string): Promise<void> {
  const store = getStore();
  const key = sha256(token);
  for (const collection of ['oauth:refresh', 'oauth:tokens']) {
    const doc = await store.get(`${collection}/${key}`);
    if (doc && doc.clientId === clientId) {
      await endConnection(str(doc, 'uid'), str(doc, 'connection'));
      return;
    }
  }
}
