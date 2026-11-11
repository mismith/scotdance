import { HttpsError } from 'firebase-functions/v2/https';
import { COLLECTIONS } from './common';
import { decide, describeRequest, endByOwner } from './connect';
import { getStore, runtime } from './runtime';

/** The account holder's side of connecting an assistant (ADR 0018): the callables behind the /connect page and Account */

const TOKEN = /^[A-Za-z0-9_-]{10,64}$/;

interface Context {
  auth: { uid: string; token?: { via?: unknown } } | null;
}

/**
 * An assistant's session is signed in as its owner, with a token marked `via: 'mcp'` (ADR 0018). Its way in is
 * the tools and nothing else, so every callable here turns such a token away.
 */
export function humansOnly(ctx: Context): void {
  if (ctx.auth?.token?.via === 'mcp') throw new HttpsError('permission-denied', 'AI assistants can’t do this.');
}

function signedIn(ctx: Context): string {
  humansOnly(ctx);
  const uid = ctx.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return uid;
}

function field(data: unknown, name: string): string {
  const value = (data as Record<string, unknown> | null | undefined)?.[name];
  if (typeof value !== 'string' || !TOKEN.test(value)) throw new HttpsError('invalid-argument', `${name} is not valid.`);
  return value;
}

/** The /connect page asks what an authorization request is for, before the person chooses */
export const onConnectionRequest = (data: unknown, ctx: Context) => {
  signedIn(ctx);
  return describeRequest(field(data, 'request'));
};

/** Whether they are a system admin or an admin of at least one competition or organisation: the only people who can connect an AI assistant */
export async function managesAnything(uid: string): Promise<boolean> {
  const permissions = await getStore().get(`users:permissions/${uid}`);
  if (!permissions) return false;
  const any = (v: unknown) => !!v && typeof v === 'object' && Object.values(v).some((x) => x === true);
  return permissions.admin === true || any(permissions.competitions) || any(permissions.organisations);
}

/**
 * The person allowed it (or said no): make the connection and return the redirect with a one-use code. Only people who
 * manage something can allow one (the page says so; this is what holds if it is skipped). Saying no is open to anyone.
 */
export const onApproveConnection = async (data: unknown, ctx: Context) => {
  const uid = signedIn(ctx);
  const deny = (data as Record<string, unknown> | null | undefined)?.deny as unknown;
  if (deny !== undefined && typeof deny !== 'boolean') throw new HttpsError('invalid-argument', 'deny is not valid.');
  const request = field(data, 'request');
  if (deny !== true && !(await managesAnything(uid))) {
    throw new HttpsError('permission-denied', 'An AI assistant can only work with the competitions and organisations you manage, and you don’t manage any yet.');
  }
  return decide(uid, { request, deny: deny as boolean | undefined });
};

/** The person ended a connection (or, naming none, every one: deleting their account): it and its tokens go */
export const onEndConnection = async (data: unknown, ctx: Context) => {
  const uid = signedIn(ctx);
  const named = (data as Record<string, unknown> | null | undefined)?.connection;
  await endByOwner(uid, named === undefined ? undefined : field(data, 'connection'));
  return { ok: true };
};

/** Daily: the database has no expiry, so records past their time go (requests, codes, tokens, refresh tokens) */
export async function sweepExpired(): Promise<number> {
  const store = getStore();
  const found = await Promise.all(COLLECTIONS.map((collection) => store.expiredIn(collection, runtime.now())));
  const paths = found.flat();
  await store.deleteAll(paths);
  return paths.length;
}
