import { HttpsError } from 'firebase-functions/v2/https';
import { issuer } from '../mcp/config';
import type { ClientSummary } from './cimd';
import {
  CODE_TTL, SCOPE, connectionPath, expired, later, sha256, str,
} from './common';
import { endConnection } from './connections';
import { isKnownClient } from './known';
import { getStore, randomToken, runtime } from './runtime';
import { KEEP, type Doc } from './store';

/** What the /connect page and the callables work with: the account holder's side of an authorization request */

const GONE = 'That request has run out';

const clientOf = (doc: Doc) => doc.client as ClientSummary;

/** The same client, with only the fields that belong (nothing undefined, nothing extra) */
const clientCopy = (c: ClientSummary): ClientSummary => ({
  id: c.id,
  name: c.name,
  ...(c.uri ? { uri: c.uri } : {}),
  ...(c.logo ? { logo: c.logo } : {}),
});

export interface ConnectionRequestInfo {
  client: { name: string; host: string; uri?: string; logo?: string };
  /** ScotDance.app knows this assistant by its address; if not, the page leads with the address and warns */
  known: boolean;
}

/** What an authorization request is for */
export async function describeRequest(request: string): Promise<ConnectionRequestInfo> {
  const doc = await getStore().get(`oauth:requests/${request}`);
  if (!doc || expired(doc)) throw new HttpsError('not-found', GONE);
  const client = clientOf(doc);
  let host = '';
  try {
    host = new URL(client.id).hostname;
  } catch {
    // Not a URL: shows no host
  }
  return {
    client: {
      name: client.name, host, ...(client.uri ? { uri: client.uri } : {}), ...(client.logo ? { logo: client.logo } : {}),
    },
    known: isKnownClient(client.id),
  };
}

/** Where the browser goes back to the assistant: the redirect address plus these parameters */
function backTo(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, value);
  });
  url.searchParams.set('iss', issuer());
  return url.href;
}

/** Use the request up (it is good once): the record, or not-found if it is unknown, used or past its 10 minutes */
async function takeRequest(request: string): Promise<Doc> {
  const { before } = await getStore().update(`oauth:requests/${request}`, (doc) => (doc && !expired(doc) ? null : KEEP));
  if (!before || expired(before)) throw new HttpsError('not-found', GONE);
  return before;
}

/**
 * The account holder decided. Denied: the request goes and the assistant is told so. Allowed: the request is used
 * up, the connection is made, and a one-use code goes back to the assistant. Nothing here picks what it may reach:
 * the database rules decide that on every call, as the person (ADR 0018).
 */
export async function decide(uid: string, { request, deny }: { request: string; deny?: boolean }): Promise<{ redirect: string }> {
  const doc = await takeRequest(request);
  if (deny) {
    return { redirect: backTo(str(doc, 'redirectUri'), { error: 'access_denied', state: str(doc, 'state') || undefined }) };
  }
  const store = getStore();
  const code = randomToken();
  const connection = randomToken(16);
  const client = clientCopy(clientOf(doc));
  const now = runtime.now();
  await store.set(connectionPath(uid, connection), {
    id: connection, client, scope: SCOPE, createdAt: now, lastUsedAt: now,
  });
  await store.set(`oauth:codes/${sha256(code)}`, {
    connection,
    uid,
    scope: SCOPE,
    clientId: client.id,
    redirectUri: doc.redirectUri,
    codeChallenge: doc.codeChallenge,
    resource: doc.resource,
    expiresAt: later(CODE_TTL),
  });
  return { redirect: backTo(str(doc, 'redirectUri'), { code, state: str(doc, 'state') || undefined }) };
}

/** The account holder ends a connection (or all of theirs): it and every token made for it go */
export async function endByOwner(uid: string, connection?: string): Promise<void> {
  if (connection) return void (await endConnection(uid, connection));
  const all = await getStore().get(`users:connections/${uid}`);
  for (const id of Object.keys(all ?? {})) await endConnection(uid, id);
}
