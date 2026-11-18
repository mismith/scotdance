import { randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { linkOf } from './links';
import { isEmulator } from './utility/env';
import { entriesDances } from './entriesDances';
import { SERVICES, verifyService } from './service';
import { serviceProof } from './toolPass';
import { post, retryAccountDeletions, sendAccountDeletion, type Send } from './accountDeletion';

// ADR 0019: a narrow server-to-server bridge. The caller proves itself with its
// Google service identity (service.ts, the `service` field); neither a browser's
// Firebase token nor a sign-in pass can publish registration details or dances.
export const ENTRIES_ISSUER = 'https://entries.scotdance.app';
/** Service-identity audiences are production URLs, also when the call goes to an emulator. */
export const ENTRIES_URLS = {
  bridge: 'https://us-central1-firebase-scotdance.cloudfunctions.net/entriesCompetition',
  membership: 'https://us-central1-scotdance-entries.cloudfunctions.net/syncScotDanceMembership',
  deletion: 'https://us-central1-scotdance-entries.cloudfunctions.net/deleteScotDanceAccount',
} as const;
const key = (v: unknown): v is string => typeof v === 'string' && /^[^.#$/[\]]{1,128}$/.test(v)
  && ![...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
const read = async (db: any, path: string) => (await db.child(path).get()).val();

/** Entries development (and anything else on that project's default account) may only read. */
const DEVELOPMENT_ACTIONS = ['inspect', 'snapshot'];

/** A call from Entries' server: believed because of who sent it. The account is read as strictly as a sign-in subject. */
async function readServiceMessage(data: Record<string, any>): Promise<Record<string, any>> {
  let caller: string;
  try {
    caller = await verifyService(data.service, ENTRIES_URLS.bridge, [SERVICES.entries, SERVICES.entriesDevelopment], isEmulator());
  } catch { throw new HttpsError('unauthenticated', 'This Entries request is invalid or expired.'); }
  if (!key(data.uid) || typeof data.action !== 'string') throw new HttpsError('invalid-argument', 'An account and an action are required.');
  if (caller === SERVICES.entriesDevelopment && !DEVELOPMENT_ACTIONS.includes(data.action)) {
    throw new HttpsError('permission-denied', 'This Entries connection may only read.');
  }
  const body = { ...data, sub: data.uid };
  for (const field of ['service', 'pass', 'uid']) delete body[field];
  return body;
}

async function snapshot(db: any, competitionId: string, organisationId: string) {
  const [c, o] = await Promise.all([read(db, `competitions/${competitionId}`), read(db, `organisations/${organisationId}`)]);
  if (!c?.name || !c?.date || !o?.name) throw new HttpsError('not-found', 'The competition or organisation is no longer available.');
  const fields = (source: any, names: string[]) => Object.fromEntries(names.filter((name) => source[name] != null).map((name) => [name, source[name]]));
  return {
    competition: { id: competitionId, ...fields(c, ['name', 'date', 'venue', 'address', 'location', 'country', 'region', 'locality', 'image']) },
    organisation: { id: organisationId, ...fields(o, ['name', 'image']), shortName: typeof o.shortName === 'string' ? o.shortName.trim() || null : null },
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

// Entries links to its event page (/info); competitions published before
// 2026-11-15 stored the entry form (/enter). Publication and release share
// this list so they cannot drift apart.
const registrationPaths = (p: Record<string, any>) => ['info', 'enter']
  .map((page) => `/${page}/${encodeURIComponent(p.organisationId)}/${encodeURIComponent(p.competitionId)}`);

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
    || !registrationPaths(p).includes(url.pathname)
    || url.username || url.password || url.hash || url.search) {
    throw new HttpsError('invalid-argument', 'Registration must link to ScotDance Entries.');
  }
}

export function getOnEntriesCompetition(db: any) {
  return async (data: Record<string, any> | undefined) => {
    const p = await readServiceMessage(data ?? {});
    if (!key(p.competitionId) || !key(p.organisationId)) throw new HttpsError('invalid-argument', 'A competition and organisation are required.');
    if (p.action === 'release') {
      // Removal never deletes the source event. Only release the exact binding we own.
      const releaseTarget = p.targetId ?? p.competitionId;
      if (!key(releaseTarget) || !key(p.bindingId)) throw new HttpsError('invalid-argument', 'An Entries connection is required.');
      const original = await read(db, `competitions/${p.competitionId}`);
      if (original) await requireAccess(db, p.sub, p.competitionId, p.organisationId);
      else if (await read(db, `organisations:permissions/${p.organisationId}/users/${p.sub}`) !== true)
        throw new HttpsError('permission-denied', 'You must administer this organisation on ScotDance.app.');
      if (releaseTarget !== p.competitionId && await read(db, `competitions/${releaseTarget}`))
        await requireAccess(db, p.sub, releaseTarget, p.organisationId);
      let problem: string | null = null;
      await db.child(`competitions/${releaseTarget}`).transaction((current: any) => {
        problem = null;
        if (!current) return null; // Cold Admin SDK cache: let the server retry with its actual value.
        if (!current.entriesRegistration) return current; // Verify absence on the server, even if the local cache is stale.
        const owner = current.entriesRegistration;
        if (owner.bindingId !== p.bindingId || owner.competitionId !== p.competitionId
          || owner.organisationId !== p.organisationId || owner.targetId !== releaseTarget) {
          problem = 'This registration connection changed. Refresh before removing it.';
          return undefined;
        }
        const next = { ...current };
        delete next.entriesRegistration;
        // Never erase a replacement URL that somebody has since set on ScotDance.app.
        if (registrationPaths(p).some((path) => next.registrationURL === `${ENTRIES_ISSUER}${path}`)) {
          delete next.registrationURL;
          delete next.registrationStart;
          delete next.registrationEnd;
        }
        return next;
      });
      if (problem) throw new HttpsError('failed-precondition', problem);
      return { registrationTargetId: releaseTarget, released: true };
    }

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

    if (p.action === 'claim') {
      if (target !== p.competitionId) await requireAccess(db, p.sub, target, p.organisationId);
      const bindingId = randomUUID();
      let problem: string | null = null;
      const result = await db.child(`competitions/${target}`).transaction((current: any) => {
        problem = null;
        if (!current) return null;
        const owner = current.entriesRegistration;
        if (p.expectedBindingId != null && (!key(p.expectedBindingId) || owner?.bindingId !== p.expectedBindingId)) {
          problem = 'This Entries connection was removed or replaced. Return to Entries and refresh.';
          return undefined;
        }
        if (owner && (owner.targetId !== target || owner.competitionId !== p.competitionId || owner.organisationId !== p.organisationId)) {
          problem = 'These registration settings belong to a different Entries connection. Refresh before changing it.';
          return undefined;
        }
        return { ...current, entriesRegistration: {
          competitionId: p.competitionId, organisationId: p.organisationId, targetId: target,
          revision: owner?.revision ?? 0, bindingId: owner?.bindingId ?? bindingId,
        } };
      });
      if (!result.snapshot.exists()) throw new HttpsError('not-found', 'The competition is no longer available.');
      if (problem) throw new HttpsError('failed-precondition', problem);
      return { ...facts, registrationTargetId: target, ...result.snapshot.val().entriesRegistration };
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
      const dances = entriesDances(p.dances);
      const list = Object.fromEntries(dances.map((dance) => [db.child('competitions:data').push().key, dance]));
      const result = await db.child(`competitions:data/${p.competitionId}/dances`).transaction((current: any) =>
        current && Object.keys(current).length ? undefined : list);
      if (!result.committed) throw new HttpsError('failed-precondition', 'This competition already has dances. Edit them on ScotDance.app.');
      return { sent: Object.keys(list).length };
    }
    throw new HttpsError('invalid-argument', 'Unknown Entries action.');
  };
}


/** Read current authority on every attempt. A delayed removal must not undo a later re-invitation. */
export async function sendEntriesMembership(db: any, url: string, organisationId: string, uid: string, send: Send = post, proof = serviceProof) {
  // Concurrent triggers can run in the same millisecond. Allocate a monotonic
  // stamp so their receiver can order deliveries without a grant/revoke tie.
  const stamp = await db.child(`entries:membershipVersions/${organisationId}/${uid}`).transaction((previous: unknown) =>
    Math.max(Date.now(), typeof previous === 'number' ? previous + 1 : 0));
  const checkedAt = stamp.snapshot.val() as number;
  const allowed = await read(db, `organisations:permissions/${organisationId}/users/${uid}`) === true;
  const failure = db.child(`entries:membershipFailures/${organisationId}/${uid}`);
  try {
    const service = await proof(ENTRIES_URLS.membership);
    const result = await send(url, { data: { uid, organisationId, allowed, checkedAt, service } });
    if (!result.ok) throw new Error(`Entries membership update answered ${result.status}`);
    await failure.remove();
  } catch (error) {
    await failure.update({ failedAt: Date.now() });
    throw error; // Native trigger retries; the sweep below also retains failed deliveries.
  }
}

export function getOnEntriesMembership(db: any, url: () => string | null, send: Send = post, proof = serviceProof) {
  return async (change: any, ctx: any) => {
    if ((change.before.val() === true) === (change.after.val() === true)) return;
    const destination = url();
    if (!destination) return;
    await sendEntriesMembership(db, destination, ctx.params.organisationId, ctx.params.uid, send, proof);
  };
}

export async function retryEntriesMemberships(db: any, url: string) {
  const failed = await read(db, 'entries:membershipFailures') ?? {};
  const tasks = Object.entries(failed).flatMap(([organisationId, users]) => Object.keys(users as object).map((uid) => ({ organisationId, uid }))).slice(0, 100);
  for (const { organisationId, uid } of tasks) {
    await sendEntriesMembership(db, url, organisationId, uid).catch((error) => console.error('Entries membership retry failed', organisationId, uid, error));
  }
}

/** Account deletion is distinct from unlinking a tool: persist the request before delivery. */
export const sendEntriesAccountDeletion = (db: any, url: string, uid: string, send: Send = post, proof = serviceProof) =>
  sendAccountDeletion('entries', db, url, uid, send, proof);

export const retryEntriesAccountDeletions = (db: any, url: string, send: Send = post, proof = serviceProof) =>
  retryAccountDeletions('entries', db, url, send, proof);
