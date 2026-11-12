import { createHmac, randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';

// "Sign in with ScotDance.app" for ScotDance.app's own tools on other
// Firebase projects (Challenge first; ADR 0015). The connect page, signed in
// here, asks for a pass for one tool; the tool's own function checks it with
// the same secret and signs the person in there. Short-lived and for that tool
// alone: never this project's own sign-in, so a tool can't act as you here.
//
// A compact JWT, HS256: { iss, aud, sub (uid), email, name, iat, exp, jti }.
// Entries' also says which organisations they're an admin of
// (`organisations: [{ id, name }]`), so the organisation they take entries
// and payments for there is the one here, under the same id.
//
// Each pass is noted in `users:tools/{uid}/{tool}` (first and last sign-in),
// so people see the tools they use in Account, and can unlink one: an unlink
// pass (aud `{tool}:unlink`, which no tool takes as a sign-in) to the tool's
// own `unlinkScotDance`, which signs them out there everywhere (ADR 0017).

export const AUDIENCES = ['challenge', 'binder', 'entries'] as const;
export type Audience = (typeof AUDIENCES)[number];
export const ISSUER = 'https://scotdance.app';
export const PASS_SECONDS = 120;

/** Each tool's `unlinkScotDance` callable (its Firebase project's functions, us-central1). */
export const UNLINK_URLS: Record<Audience, string> = {
  challenge: 'https://us-central1-scotdance-challenge.cloudfunctions.net/unlinkScotDance',
  binder: 'https://us-central1-scotdance-binder.cloudfunctions.net/unlinkScotDance',
  entries: 'https://us-central1-scotdance-entries.cloudfunctions.net/unlinkScotDance',
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function signPass(
  secret: string,
  who: {
    uid: string; email?: string | null; name?: string | null; audience: Audience | `${Audience}:unlink`;
    organisations?: PassOrganisation[];
    competitions?: PassCompetition[];
  },
  now = Date.now(),
): string {
  const iat = Math.floor(now / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: ISSUER,
    aud: who.audience,
    sub: who.uid,
    email: who.email ?? null,
    name: who.name ?? null,
    ...(who.organisations ? { organisations: who.organisations } : {}),
    ...(who.competitions ? { competitions: who.competitions } : {}),
    iat,
    exp: iat + PASS_SECONDS,
    jti: randomUUID(),
  });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/** An organisation they're an admin of, as Entries' pass names it. */
export interface PassOrganisation {
  id: string;
  name: string;
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

interface Context {
  auth: { uid: string; token: { email?: string; name?: string; firebase?: { sign_in_provider?: string } } } | null;
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
  const names = await Promise.all(ids.map(async (id) => (await db.child(`organisations/${id}/name`).get()).val()));
  return ids
    .map((id, i) => ({ id, name: names[i] }))
    .filter((o): o is PassOrganisation => typeof o.name === 'string' && !!o.name.trim());
}

/**
 * toolPass({ audience }): a pass for that tool, for whoever is signed in.
 * Their name as the app shows it ("Continue as …"): their record's, then their sign-in's.
 */
export function getOnToolPass(secret: () => string, db: Db) {
  return async (data: { audience?: unknown } | undefined, ctx: Context) => {
    const auth = ctx.auth;
    if (!auth?.uid || auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('unauthenticated', 'Sign in to ScotDance.app first.');
    }
    if (!isAudience(data?.audience)) throw new HttpsError('invalid-argument', 'Unknown tool.');
    const recorded = (await db.child(`users/${auth.uid}/displayName`).get()).val();
    const name = (typeof recorded === 'string' && recorded.trim()) || auth.token.name || null;
    const link = db.child(`users:tools/${auth.uid}/${data.audience}`);
    const linkedAt = ((await link.get()).val() as Partial<ToolLink> | null)?.linkedAt;
    const now = Date.now();
    await link.update({ linkedAt: linkedAt ?? now, signedInAt: now });
    return {
      pass: signPass(secret(), {
        uid: auth.uid,
        email: auth.token.email ?? null,
        name,
        audience: data.audience,
        ...(data.audience === 'entries' ? { organisations: await adminOf(db, auth.uid), competitions: await upcomingManaged(db, auth.uid, now) } : {}),
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
 * emulator, unless one is running for it).
 */
export function getOnUnlinkTool(secret: () => string, db: Db, urls: (tool: Audience) => string | null, send: Post = post) {
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
        const pass = signPass(secret(), { uid, audience: `${tool}:unlink` });
        const res = await send(url, { data: { pass } }).catch(() => ({ ok: false, status: 0 }));
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
