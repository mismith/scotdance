import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { linkOf } from './links';
import { isEmulator } from './utility/env';

// ADR 0019: a narrow server-to-server bridge. Every mutable value is inside
// the signed pass; neither a browser's Firebase token nor a sign-in pass can
// publish registration details or dances.
export const ENTRIES_ISSUER = 'https://entries.scotdance.app';
export const ENTRIES_AUDIENCE = 'scotdance:entries';
const key = (v: unknown): v is string => typeof v === 'string' && /^[^.#$/[\]]{1,128}$/.test(v)
  && ![...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
const read = async (db: any, path: string) => (await db.child(path).get()).val();
const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

export function signEntriesMessage(secret: string, payload: Record<string, unknown>, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode({ ...payload, iat, exp: iat + 120, jti: randomUUID() });
  return `${header}.${body}.${createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')}`;
}

export function readEntriesMessage(pass: unknown, secret: string, now = Date.now()): Record<string, any> {
  const denied = () => new HttpsError('unauthenticated', 'This Entries request is invalid or expired.');
  if (typeof pass !== 'string' || pass.length > 100_000) throw denied();
  const parts = pass.split('.');
  if (parts.length !== 3) throw denied();
  const [head, body, signature] = parts;
  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw denied();
  let h: any; let p: any;
  try {
    h = JSON.parse(Buffer.from(head, 'base64url').toString());
    p = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch { throw denied(); }
  const seconds = Math.floor(now / 1000);
  if (h?.alg !== 'HS256' || h?.typ !== 'JWT' || p?.iss !== ENTRIES_ISSUER || p?.aud !== ENTRIES_AUDIENCE
    || !key(p.sub) || typeof p.jti !== 'string' || !p.jti || p.jti.length > 128
    || !Number.isInteger(p.iat) || !Number.isInteger(p.exp) || p.iat > seconds + 5
    || p.exp <= seconds || p.exp <= p.iat || p.exp - p.iat > 120) throw denied();
  return p;
}

async function snapshot(db: any, competitionId: string, organisationId: string) {
  const [c, o] = await Promise.all([read(db, `competitions/${competitionId}`), read(db, `organisations/${organisationId}`)]);
  if (!c?.name || !c?.date || !o?.name) throw new HttpsError('not-found', 'The competition or organisation is no longer available.');
  const fields = (source: any, names: string[]) => Object.fromEntries(names.filter((name) => source[name] != null).map((name) => [name, source[name]]));
  return {
    competition: { id: competitionId, ...fields(c, ['name', 'date', 'venue', 'address', 'location', 'country', 'region', 'locality', 'image']) },
    organisation: { id: organisationId, ...fields(o, ['name', 'image']) },
  };
}

async function requireAccess(db: any, uid: string, competitionId: string, organisationId: string) {
  const [competition, organisation] = await Promise.all([
    read(db, `users:permissions/${uid}/competitions/${competitionId}`),
    read(db, `organisations:permissions/${organisationId}/users/${uid}`),
  ]);
  if (competition !== true || organisation !== true) {
    throw new HttpsError('permission-denied', 'You must administer both this competition and its organisation on ScotDance.app.');
  }
}

export async function registrationTarget(db: any, competitionId: string): Promise<string> {
  if (await read(db, `competitionLinks:sync/${competitionId}/registration`) !== true) return competitionId;
  const link = await linkOf(db, competitionId);
  if (!link?.primary || !link.members.includes(competitionId)) throw new HttpsError('failed-precondition', 'The shared registration settings need a main competition.');
  return link.primary;
}

function dates(p: Record<string, any>) {
  for (const field of ['registrationStart', 'registrationEnd']) {
    if (p[field] != null && (!Number.isSafeInteger(p[field]) || p[field] <= 0)) throw new HttpsError('invalid-argument', 'Registration dates must be timestamps or empty.');
  }
  if (p.registrationStart != null && p.registrationEnd != null && p.registrationStart >= p.registrationEnd) {
    throw new HttpsError('invalid-argument', 'Registration must close after it opens.');
  }
  if (!Number.isSafeInteger(p.revision) || p.revision < 1) throw new HttpsError('invalid-argument', 'A registration revision is required.');
  let url: URL;
  try { url = new URL(p.registrationURL); } catch { throw new HttpsError('invalid-argument', 'An Entries registration link is required.'); }
  const local = isEmulator() && ['http://localhost:5290', 'http://127.0.0.1:5290'].includes(url.origin);
  if ((url.origin !== ENTRIES_ISSUER && !local)
    || url.pathname !== `/enter/${encodeURIComponent(p.organisationId)}/${encodeURIComponent(p.competitionId)}`
    || url.username || url.password || url.hash || url.search) {
    throw new HttpsError('invalid-argument', 'Registration must link to ScotDance Entries.');
  }
}

export function getOnEntriesCompetition(secret: () => string, db: any) {
  return async (data: { pass?: unknown } | undefined) => {
    const p = readEntriesMessage(data?.pass, secret());
    if (!key(p.competitionId) || !key(p.organisationId)) throw new HttpsError('invalid-argument', 'A competition and organisation are required.');
    const facts = await snapshot(db, p.competitionId, p.organisationId);
    if (p.action === 'snapshot') return facts; // Public fields only, including unlisted competitions.
    const service = p.action === 'registration' && p.authority === 'service' && p.sub === 'entries-service';
    if (!service) await requireAccess(db, p.sub, p.competitionId, p.organisationId);
    const target = await registrationTarget(db, p.competitionId);
    if (p.action === 'inspect') {
      const owner = await read(db, `competitions/${target}/entriesRegistration`);
      return { ...facts, registrationTargetId: target,
        ...(owner?.competitionId === p.competitionId && owner?.organisationId === p.organisationId
          ? { bindingId: owner.bindingId ?? null, revision: owner.revision } : {}) };
    }

    if (p.action === 'claim' || p.action === 'unlink') {
      if (target !== p.competitionId) await requireAccess(db, p.sub, target, p.organisationId);
      if (p.action === 'unlink' && !key(p.bindingId)) throw new HttpsError('invalid-argument', 'A registration binding is required.');
      const bindingId = randomUUID();
      let problem: string | null = null;
      const result = await db.child(`competitions/${target}`).transaction((current: any) => {
        problem = null;
        if (!current) return null;
        const owner = current.entriesRegistration;
        if (owner && (owner.targetId !== target || owner.competitionId !== p.competitionId || owner.organisationId !== p.organisationId
          || (p.action === 'unlink' && owner.bindingId !== p.bindingId))) {
          problem = 'These registration settings belong to a different Entries connection. Refresh before changing it.';
          return undefined;
        }
        if (p.action === 'claim') return { ...current, entriesRegistration: {
          competitionId: p.competitionId, organisationId: p.organisationId, targetId: target,
          revision: owner?.revision ?? 0, bindingId: owner?.bindingId ?? bindingId,
        } };
        if (!owner) return undefined;
        const next = { ...current };
        for (const field of ['entriesRegistration', 'registrationURL', 'registrationStart', 'registrationEnd']) delete next[field];
        next.entriesRegistrationReleasedBinding = p.bindingId;
        return next;
      });
      if (!result.snapshot.exists()) throw new HttpsError('not-found', 'The competition is no longer available.');
      if (problem) throw new HttpsError('failed-precondition', problem);
      if (p.action === 'claim') return { registrationTargetId: target, ...result.snapshot.val().entriesRegistration };
      // Clear only copies of this exact binding, never a newly linked owner.
      const link = await linkOf(db, p.competitionId);
      for (const id of link?.members ?? []) {
        if (id === target) continue;
        await db.child(`competitions/${id}`).transaction((current: any) => {
          if (!current) return null;
          const owner = current.entriesRegistration;
          if (owner?.bindingId !== p.bindingId || owner?.competitionId !== p.competitionId || owner?.organisationId !== p.organisationId) return undefined;
          const next = { ...current };
          for (const field of ['entriesRegistration', 'registrationURL', 'registrationStart', 'registrationEnd']) delete next[field];
          next.entriesRegistrationReleasedBinding = p.bindingId;
          return next;
        });
      }
      return { released: true, registrationTargetId: target };
    }

    if (p.action === 'registration') {
      dates(p);
      if (!service && target !== p.competitionId) await requireAccess(db, p.sub, target, p.organisationId);
      let problem: string | null = null;
      const result = await db.child(`competitions/${target}`).transaction((current: any) => {
        problem = null;
        if (!current) return null; // A cold Admin SDK cache starts at null; allow its server retry.
        if (!current.date) { problem = 'The competition is no longer available.'; return undefined; }
        const owner = current.entriesRegistration;
        if (service && (!key(p.bindingId) || !owner || owner.bindingId !== p.bindingId)) {
          problem = 'This Entries connection is no longer authorised to publish registration.';
          return undefined;
        }
        if (owner && owner.targetId !== target) {
          problem = 'The shared registration destination changed. Refresh and publish again.';
          return undefined;
        }
        if (owner && (owner.competitionId !== p.competitionId || owner.organisationId !== p.organisationId)) {
          problem = 'These shared registration settings already belong to another Entries competition. Stop sharing registration to configure it separately.';
          return undefined;
        }
        if (owner?.revision >= p.revision) return undefined; // Retries and late publication cannot roll back newer dates.
        return {
          ...current,
          registrationURL: p.registrationURL,
          registrationStart: p.registrationStart ?? null,
          registrationEnd: p.registrationEnd ?? null,
          entriesRegistration: { competitionId: p.competitionId, organisationId: p.organisationId, targetId: target, revision: p.revision,
            ...(owner?.bindingId && { bindingId: owner.bindingId }) },
        };
      });
      if (!result.snapshot.exists()) throw new HttpsError('not-found', 'The competition is no longer available.');
      if (problem) throw new HttpsError('failed-precondition', problem);
      return { registrationTargetId: target, revision: result.snapshot.val()?.entriesRegistration?.revision, applied: result.committed };
    }

    if (p.action === 'dances') {
      if (!Array.isArray(p.dances) || !p.dances.length || p.dances.length > 200) throw new HttpsError('invalid-argument', 'Send between one and 200 dances.');
      const unique = new Map<string, { name: string; steps?: string | number; _order: number }>();
      for (const dance of p.dances) {
        if (!dance || typeof dance.name !== 'string' || !dance.name.trim() || dance.name.length > 120
          || (dance.steps != null && !(typeof dance.steps === 'number' && Number.isFinite(dance.steps)) && !(typeof dance.steps === 'string' && dance.steps.length <= 40))) {
          throw new HttpsError('invalid-argument', 'Each dance needs a name and valid steps.');
        }
        const name = dance.name.trim();
        const fingerprint = `${name.toLowerCase()}|${String(dance.steps ?? '').trim()}`;
        if (!unique.has(fingerprint)) unique.set(fingerprint, { name, ...(dance.steps != null && { steps: dance.steps }), _order: unique.size });
      }
      const list = Object.fromEntries([...unique.values()].map((dance) => [db.child('competitions:data').push().key, dance]));
      const result = await db.child(`competitions:data/${p.competitionId}/dances`).transaction((current: any) =>
        current && Object.keys(current).length ? undefined : list);
      if (!result.committed) throw new HttpsError('failed-precondition', 'This competition already has dances. Edit them on ScotDance.app.');
      return { sent: Object.keys(list).length };
    }
    throw new HttpsError('invalid-argument', 'Unknown Entries action.');
  };
}

type Send = (url: string, body: unknown) => Promise<{ ok: boolean; status: number }>;
const post: Send = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });

/** Read current authority on every attempt. A delayed removal must not undo a later re-invitation. */
export async function sendEntriesMembership(db: any, secret: string, url: string, organisationId: string, uid: string, send: Send = post) {
  // Concurrent triggers can run in the same millisecond. Allocate a monotonic
  // stamp so their receiver can order deliveries without a grant/revoke tie.
  const stamp = await db.child(`entries:membershipVersions/${organisationId}/${uid}`).transaction((previous: unknown) =>
    Math.max(Date.now(), typeof previous === 'number' ? previous + 1 : 0));
  const checkedAt = stamp.snapshot.val() as number;
  const allowed = await read(db, `organisations:permissions/${organisationId}/users/${uid}`) === true;
  const pass = signEntriesMessage(secret, { iss: 'https://scotdance.app', aud: 'entries:membership', sub: uid, organisationId, allowed, checkedAt });
  const failure = db.child(`entries:membershipFailures/${organisationId}/${uid}`);
  try {
    const result = await send(url, { data: { pass } });
    if (!result.ok) throw new Error(`Entries membership update answered ${result.status}`);
    await failure.remove();
  } catch (error) {
    await failure.update({ failedAt: Date.now() });
    throw error; // Native trigger retries; the sweep below also retains failed deliveries.
  }
}

export function getOnEntriesMembership(secret: () => string, db: any, url: () => string | null, send: Send = post) {
  return async (change: any, ctx: any) => {
    if ((change.before.val() === true) === (change.after.val() === true)) return;
    const destination = url();
    if (!destination) return;
    await sendEntriesMembership(db, secret(), destination, ctx.params.organisationId, ctx.params.uid, send);
  };
}

export async function retryEntriesMemberships(db: any, secret: string, url: string) {
  const failed = await read(db, 'entries:membershipFailures') ?? {};
  const tasks = Object.entries(failed).flatMap(([organisationId, users]) => Object.keys(users as object).map((uid) => ({ organisationId, uid }))).slice(0, 100);
  for (const { organisationId, uid } of tasks) {
    await sendEntriesMembership(db, secret, url, organisationId, uid).catch((error) => console.error('Entries membership retry failed', organisationId, uid, error));
  }
}

/** Account deletion is distinct from unlinking a tool: persist the request before delivery. */
export async function sendEntriesAccountDeletion(db: any, secret: string, url: string, uid: string, send: Send = post) {
  const pending = db.child(`entries:accountDeletions/${uid}`);
  const request = await read(db, `entries:accountDeletions/${uid}`);
  if (!request || request.state === 'complete') return;
  const pass = signEntriesMessage(secret, { iss: 'https://scotdance.app', aud: 'entries:delete', sub: uid, deletedAt: request.deletedAt });
  const result = await send(url, { data: { pass } });
  if (!result.ok) throw new Error(`Entries account deletion answered ${result.status}`);
  await pending.update({ state: 'complete', completedAt: Date.now() });
}

export async function retryEntriesAccountDeletions(db: any, secret: string, url: string, send: Send = post) {
  const requests = await read(db, 'entries:accountDeletions') ?? {};
  for (const [uid] of Object.entries(requests).filter(([, value]: [string, any]) => value.state !== 'complete').slice(0, 100)) {
    await sendEntriesAccountDeletion(db, secret, url, uid, send).catch((error) => console.error('Entries account deletion retry failed', uid, error));
  }
}
