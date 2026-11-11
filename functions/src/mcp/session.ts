import { runtime } from '../oauth/runtime';
import { emulated, endpoints, issuer } from './config';
import type { Access } from './types';

/**
 * Acting as the person (ADR 0018): never the Admin SDK for their data. The Admin SDK only mints a custom token for
 * their uid with { via: 'mcp', scope }; that is exchanged for an ID token with Identity Toolkit, and every read and
 * write goes to the Realtime Database's REST API with it. So `firebase.rules.json` decides everything, as it does for
 * the person at the keyboard, and triggers see the real `auth.uid`.
 *
 * REST rather than the client SDK: a function instance would otherwise hold a websocket (and its listeners and
 * reconnection) per connection, for requests that each need one read or write and then wait. A fetch needs nothing
 * kept alive and runs the same against the emulators.
 */

/** Anything that can mint a custom token (the Admin SDK's Auth) */
export interface TokenMinter {
  createCustomToken(uid: string, claims: Record<string, unknown>): Promise<string>;
}

/** What a callable's handler takes (organisations.ts `getOnCreate`): the data it was called with, and who called */
export type CallableHandler = (data: unknown, ctx: { auth: { uid: string; token: { via: 'mcp' } } }) => Promise<unknown>;

export interface Deps {
  auth: TokenMinter;
  /** The data namespace in the database: `production` or `development` */
  env: string;
  /**
   * `createOrganisation`'s handler. Making an organisation (and its admin) takes the Admin SDK, which the callable has
   * and a session does not; the callable itself stays closed to assistants, and its tool reaches the handler here, as
   * the person but never with a system admin's rights (the token says `via: 'mcp'`).
   */
  createOrganisation?: CallableHandler;
}

export type Query = Record<string, string | number | boolean>;

/** A failed database request: `permission-denied` is the rules saying no */
export class DatabaseError extends Error {
  constructor(readonly code: 'permission-denied' | 'unavailable', readonly status: number) {
    super(`database ${code} (${status})`);
  }
}

export interface Session {
  uid: string;
  connection: string;
  /** The assistant's name, as it named itself (shown in the change log) */
  client: string;
  read(path: string, query?: Query): Promise<unknown>;
  write(path: string, value: unknown): Promise<void>;
  /** Several writes at once, by path (null removes), atomically */
  update(values: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  /** Make an organisation, as `createOrganisation` does for the person (undefined where the server was not given it) */
  createOrganisation?(data: Record<string, unknown>): Promise<{ organisationId: string }>;
}

interface Entry {
  minted: number;
  token: Promise<string>;
}

/** How many connections' tokens to keep warm, and how long before one is exchanged afresh (they last an hour) */
const MAX_SESSIONS = 100;
const REMINT_MS = 50 * 60 * 1000;
const tokens = new Map<string, Entry>();

const keyOf = (a: Access) => [a.connection, a.uid, a.scope].join('|');

async function signIn(deps: Deps, access: Access): Promise<string> {
  const custom = await deps.auth.createCustomToken(access.uid, { via: 'mcp', scope: access.scope });
  const res = await runtime.fetch(endpoints().signIn, {
    method: 'POST',
    // The web key only answers requests from the app's own pages, so say whose page this is for
    headers: { 'Content-Type': 'application/json', Referer: `${issuer()}/` },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const body = (await res.json().catch(() => ({}))) as { idToken?: string };
  if (!res.ok || !body.idToken) throw new DatabaseError('unavailable', res.status);
  return body.idToken;
}

/** The ID token for this connection: one per connection and uid, cached up to 50 minutes */
function idToken(deps: Deps, access: Access, fresh = false): Promise<string> {
  const key = keyOf(access);
  const held = tokens.get(key);
  if (held && !fresh && runtime.now() - held.minted < REMINT_MS) {
    // Most recently used last, so the oldest goes first
    tokens.delete(key);
    tokens.set(key, held);
    return held.token;
  }
  while (tokens.size >= MAX_SESSIONS) tokens.delete(tokens.keys().next().value as string);
  const entry: Entry = { minted: runtime.now(), token: signIn(deps, access) };
  tokens.set(key, entry);
  // A sign-in that failed isn't kept
  entry.token.catch(() => { if (tokens.get(key) === entry) tokens.delete(key); });
  return entry.token;
}

/** For tests: forget every cached sign-in */
export const forgetSessions = () => tokens.clear();

const encodePath = (env: string, path: string) => [env, ...path.split('/').filter(Boolean)].map(encodeURIComponent).join('/');

export function sessionFor(deps: Deps, access: Access): Session {
  async function call(method: string, path: string, body?: unknown, query: Query = {}, retried = false): Promise<unknown> {
    const token = await idToken(deps, access, retried);
    const { database } = endpoints();
    const params = new URLSearchParams({ auth: token, ...(emulated() ? { ns: 'scotdance' } : {}) });
    for (const [key, value] of Object.entries(query)) params.set(key, typeof value === 'string' ? JSON.stringify(value) : String(value));
    const res = await runtime.fetch(`${database}/${encodePath(deps.env, path)}.json?${params}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const detail = String(((await res.json().catch(() => ({}))) as { error?: unknown }).error ?? '');
    // An ID token that ran out is exchanged afresh, once; anything else the rules said is final
    if (res.status === 401 && !retried && /auth token|expired|invalid/i.test(detail) && !/permission denied/i.test(detail)) {
      return call(method, path, body, query, true);
    }
    throw new DatabaseError(res.status === 401 || res.status === 403 ? 'permission-denied' : 'unavailable', res.status);
  }
  return {
    uid: access.uid,
    connection: access.connection,
    client: access.client.name,
    read: (path, query) => call('GET', path, undefined, query),
    write: async (path, value) => { await call('PUT', path, value); },
    update: async (values) => { await call('PATCH', '', values); },
    remove: async (path) => { await call('DELETE', path); },
    createOrganisation: deps.createOrganisation
      ? async (data) => (await deps.createOrganisation!(data, { auth: { uid: access.uid, token: { via: 'mcp' } } })) as { organisationId: string }
      : undefined,
  };
}
