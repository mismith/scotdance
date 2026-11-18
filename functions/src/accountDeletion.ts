import { serviceProof } from './toolPass';

/** Tools told, durably, when a ScotDance.app account is deleted (queue: `<tool>:accountDeletions/{uid}`). */
export const DELETION_TOOLS = ['entries', 'binder', 'challenge'] as const;
export type DeletionTool = (typeof DELETION_TOOLS)[number];

/** Service-identity audiences are the receivers' production URLs, also when the call goes to an emulator. */
export const DELETION_URLS: Record<DeletionTool, string> = {
  entries: 'https://us-central1-scotdance-entries.cloudfunctions.net/deleteScotDanceAccount',
  binder: 'https://us-central1-scotdance-binder.cloudfunctions.net/deleteScotDanceAccount',
  challenge: 'https://us-central1-scotdance-challenge.cloudfunctions.net/deleteScotDanceAccount',
};

export type Send = (url: string, body: unknown) => Promise<{ ok: boolean; status: number }>;
export const post: Send = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });

/**
 * Account deletion is distinct from unlinking a tool: persist the request before delivery.
 * `legacyPass` (Entries only, LEGACY(tool-pass-secret)) adds the old signed pass and lets the call go without
 * a service proof. Without it, a missing proof fails the delivery so it is retried.
 */
export async function sendAccountDeletion(
  tool: DeletionTool, db: any, url: string, uid: string, send: Send = post, proof = serviceProof,
  legacyPass?: (deletedAt: number) => string,
) {
  const path = `${tool}:accountDeletions/${uid}`;
  const request = (await db.child(path).get()).val();
  if (!request || request.state === 'complete') return;
  const service = await proof(DELETION_URLS[tool]);
  if (!service && !legacyPass) throw new Error(`No service proof for ${tool} account deletion`);
  const pass = legacyPass?.(request.deletedAt);
  const result = await send(url, { data: { uid, deletedAt: request.deletedAt, ...(service ? { service } : {}), ...(pass ? { pass } : {}) } });
  if (!result.ok) throw new Error(`${tool} account deletion answered ${result.status}`);
  await db.child(path).update({ state: 'complete', completedAt: Date.now() });
}

export async function retryAccountDeletions(
  tool: DeletionTool, db: any, url: string, send: Send = post, proof = serviceProof,
  legacyPass?: (uid: string, deletedAt: number) => string,
) {
  const requests = (await db.child(`${tool}:accountDeletions`).orderByChild('state').equalTo('pending').limitToFirst(100).get()).val() ?? {};
  const deadline = Date.now() + 45_000;
  for (const uid of Object.keys(requests)) {
    if (Date.now() >= deadline) break;
    await sendAccountDeletion(tool, db, url, uid, send, proof, legacyPass && ((deletedAt) => legacyPass(uid, deletedAt)))
      .catch((error) => console.error(`${tool} account deletion retry failed`, uid, error));
  }
}
