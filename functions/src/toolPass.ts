import { randomUUID, sign, type KeyObject } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { keyId } from './passKeys';
import { SERVICES, serviceToken } from './service';
import { isEmulator } from './utility/env';

// "Sign in with ScotDance.app" for ScotDance.app's own tools on other
// Firebase projects (Challenge first; ADR 0015). The connect page, signed in
// here, asks for a pass for one tool; the tool's own function checks it with
// the public key (passKeys.ts) and signs the person in there. Short-lived and for that tool
// alone: never this project's own sign-in, so a tool can't act as you here.
//
// A compact JWT, EdDSA (our private key, header kid): { iss, aud, sub (uid), email, name, iat, exp, jti }.
// Entries' also says which organisations they're an admin of
// (`organisations: [{ id, name, shortName }]`), so the organisation they take entries
// and payments for there is the one here, under the same id.
//
// Each pass is noted in `users:tools/{uid}/{tool}` (first and last sign-in),
// so people see the tools they use in Account, and can unlink one: an unlink
// call to the tool's own `unlinkScotDance`, which signs them out there
// everywhere (ADR 0017). That call is server to server: it carries our service
// identity (service.ts).

export const AUDIENCES = ['challenge', 'binder', 'entries'] as const;
export type Audience = (typeof AUDIENCES)[number];
/** What toolPass will sign for. `entries-dev` is Entries development: its link is still `entries`. */
export type PassAudience = Audience | 'entries-dev';
export const isEntries = (audience: PassAudience) => audience === 'entries' || audience === 'entries-dev';
export const ISSUER = 'https://scotdance.app';
export const PASS_SECONDS = 120;

/** Each tool's `unlinkScotDance` callable (its Firebase project's functions, us-central1). */
export const UNLINK_URLS: Record<Audience, string> = {
  challenge: 'https://us-central1-scotdance-challenge.cloudfunctions.net/unlinkScotDance',
  binder: 'https://us-central1-scotdance-binder.cloudfunctions.net/unlinkScotDance',
  entries: 'https://us-central1-scotdance-entries.cloudfunctions.net/unlinkScotDance',
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export interface PassWho {
  uid: string; email?: string | null; emailVerified?: boolean; name?: string | null; audience: PassAudience;
  organisations?: PassOrganisation[];
  competitions?: PassCompetition[];
}

function passClaims(who: PassWho, iat: number) {
  return {
    iss: ISSUER,
    aud: who.audience,
    sub: who.uid,
    email: who.email ?? null,
    emailVerified: who.emailVerified === true,
    name: who.name ?? null,
    ...(who.organisations ? { organisations: who.organisations } : {}),
    ...(who.competitions ? { competitions: who.competitions } : {}),
    iat,
    exp: iat + PASS_SECONDS,
    jti: randomUUID(),
  };
}

export function signPass(key: KeyObject, who: PassWho, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = encode({ alg: 'EdDSA', typ: 'JWT', kid: keyId(key) });
  const payload = encode(passClaims(who, iat));
  return `${header}.${payload}.${sign(null, Buffer.from(`${header}.${payload}`), key).toString('base64url')}`;
}

/** Our proof to a receiver (its production URL). Throws if Google won't give one: a call without it is never sent. */
export function serviceProof(audience: string): Promise<string> {
  return serviceToken(audience, SERVICES.hub, isEmulator());
}

/** An organisation they're an admin of, as Entries' pass names it. */
export interface PassOrganisation {
  id: string;
  name: string;
  shortName?: string | null;
}

export interface PassCompetition {
  id: string;
  name: string;
  date: string | number;
}

/** The date is a calendar day, so keep today's competitions regardless of the server's UTC offset. */
async function upcomingManaged(db: Db, uid: string, now: number): Promise<PassCompetition[]> {
  const permissions = ((await db.child(`users:permissions/${uid}/competitions`).get()).val() ?? {}) as Record<string, unknown>;
  const ids = Object.keys(permissions).filter((id) => permissions[id] === true);
  const rows = await Promise.all(ids.map(async (id) => {
    const c = (await db.child(`competitions/${id}`).get()).val() as Partial<PassCompetition> | null;
    if (!c || typeof c.name !== 'string' || !c.name.trim() || !c.date) return null;
    const date = typeof c.date === 'number' ? c.date : Date.parse(c.date);
    if (!Number.isFinite(date) || date + 36 * 60 * 60 * 1000 < now) return null;
    return { id, name: c.name, date: c.date };
  }));
  return rows.filter((c): c is PassCompetition => c !== null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.name.localeCompare(b.name));
}

export function isAudience(value: unknown): value is Audience {
  return typeof value === 'string' && (AUDIENCES as readonly string[]).includes(value);
}

export function isPassAudience(value: unknown): value is PassAudience {
  return value === 'entries-dev' || isAudience(value);
}

interface Context {
  auth: { uid: string; token: { email?: string; email_verified?: boolean; name?: string; firebase?: { sign_in_provider?: string } } } | null;
}

interface Db {
  child(path: string): {
    get(): Promise<{ val(): unknown }>;
    update(values: Record<string, unknown>): Promise<unknown>;
    remove(): Promise<unknown>;
  };
}

/** When someone first and last signed in to a tool. */
export interface ToolLink {
  linkedAt: number;
  signedInAt: number;
}

/** The organisations someone is an admin of (ADR 0005), with their names. Ones since deleted are left out. */
async function adminOf(db: Db, uid: string): Promise<PassOrganisation[]> {
  const ids = Object.entries(((await db.child(`users:permissions/${uid}/organisations`).get()).val() as Record<string, unknown> | null) ?? {})
    .filter(([, allowed]) => allowed === true)
    .map(([id]) => id);
  const organisations = await Promise.all(ids.map(async (id) => (await db.child(`organisations/${id}`).get()).val()));
  return ids.flatMap((id, i): PassOrganisation[] => {
    const record = organisations[i];
    if (!record || typeof record !== 'object') return [];
    const organisation = record as Record<string, unknown>;
    if (typeof organisation.name !== 'string' || !organisation.name.trim()) return [];
    return [{ id, name: organisation.name,
      shortName: typeof organisation.shortName === 'string' ? organisation.shortName.trim() || null : null }];
  });
}

/**
 * toolPass({ audience }): a pass for that tool, for whoever is signed in.
 * Their name as the app shows it ("Continue as …"): their record's, then their sign-in's.
 */
export function getOnToolPass(key: () => KeyObject, db: Db) {
  return async (data: { audience?: unknown } | undefined, ctx: Context) => {
    const auth = ctx.auth;
    if (!auth?.uid || auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('unauthenticated', 'Sign in to ScotDance.app first.');
    }
    if (!isPassAudience(data?.audience)) throw new HttpsError('invalid-argument', 'Unknown tool.');
    const recorded = (await db.child(`users/${auth.uid}/displayName`).get()).val();
    const name = (typeof recorded === 'string' && recorded.trim()) || auth.token.name || null;
    const link = db.child(`users:tools/${auth.uid}/${data.audience === 'entries-dev' ? 'entries' : data.audience}`);
    const linkedAt = ((await link.get()).val() as Partial<ToolLink> | null)?.linkedAt;
    const now = Date.now();
    await link.update({ linkedAt: linkedAt ?? now, signedInAt: now });
    return {
      pass: signPass(key(), {
        uid: auth.uid,
        email: auth.token.email ?? null,
        emailVerified: auth.token.email_verified === true,
        name,
        audience: data.audience,
        ...(isEntries(data.audience) ? { organisations: await adminOf(db, auth.uid), competitions: await upcomingManaged(db, auth.uid, now) } : {}),
      }),
    };
  };
}

type Post = (url: string, body: unknown) => Promise<{ ok: boolean; status: number }>;

const post: Post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/**
 * unlinkTool({ tool?, uid? }): sign someone out of a tool everywhere and
 * forget the link. Yourself, or anyone for a system admin. No tool: every
 * tool they've linked (deleting an account). A tool that can't be reached
 * keeps its link, so the list never says unlinked when they aren't.
 * `urls` names a tool's unlinkScotDance, or null to skip the call (the
 * emulator, unless one is running for it). The service proof is always for
 * the tool's production URL, so `proof` takes that, not `urls`.
 */
export function getOnUnlinkTool(db: Db, urls: (tool: Audience) => string | null, send: Post = post, proof = serviceProof) {
  return async (data: { tool?: unknown; uid?: unknown } | undefined, ctx: Context) => {
    const auth = ctx.auth;
    if (!auth?.uid || auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('unauthenticated', 'Sign in to ScotDance.app first.');
    }
    const uid = data?.uid ?? auth.uid;
    if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Unknown account.');
    if (uid !== auth.uid && (await db.child(`users:permissions/${auth.uid}/admin`).get()).val() !== true) {
      throw new HttpsError('permission-denied', 'Only system admins can unlink someone else.');
    }
    if (data?.tool != null && !isAudience(data.tool)) throw new HttpsError('invalid-argument', 'Unknown tool.');

    const linked = Object.keys(((await db.child(`users:tools/${uid}`).get()).val() as Record<string, unknown> | null) ?? {}).filter(isAudience);
    const tools = data?.tool == null ? linked : [data.tool as Audience];
    const failed: Audience[] = [];
    for (const tool of tools) {
      const url = urls(tool);
      if (url) {
        const res = await proof(UNLINK_URLS[tool])
          .then((service) => send(url, { data: { uid, service } }))
          .catch(() => ({ ok: false, status: 0 }));
        if (!res.ok) {
          console.error(`unlinkTool: ${tool} answered ${res.status} for ${uid}`);
          failed.push(tool);
          continue;
        }
      }
      await db.child(`users:tools/${uid}/${tool}`).remove();
    }
    if (failed.length) throw new HttpsError('unavailable', 'That tool didn’t answer. Try again in a minute.');
    return { unlinked: tools };
  };
}
