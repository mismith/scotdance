import type { database } from 'firebase-admin';

// Crowd-set tartans, with no one to approve them. Each person's pick for a
// dancer is private (users:tartanPicks/{uid}/{dancerId}) and is what they see.
// A dancer's tartan goes public (dancers:profiles/{dancerId}) only when at
// least two people picked the same one and it holds more than two thirds of
// all picks for that dancer, the rule iNaturalist uses for community IDs. One
// person can't publish anything, and one dissenter against two unpublishes
// it, which is the right way to fail for something cosmetic on a child's page.
// Custom tartans (push ids) belong to their maker and never count.
export const MIN_AGREE = 2;
export const MIN_SHARE = 2 / 3;

const isBuiltIn = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);

export function consensus(picks: Record<string, string>): string | null {
  const all = Object.values(picks);
  const counts = all.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>());
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return top && n >= MIN_AGREE && n / all.length > MIN_SHARE ? top : null;
}

/** Records one person's pick, then republishes the dancer's consensus. */
export async function onTartanPick(
  db: database.Reference,
  userId: string,
  dancerId: string,
  pick: unknown,
): Promise<void> {
  // Votes sit apart from the picks so the consensus can be recounted without
  // scanning every user; only admins and functions can read them.
  const votes = db.child(`dancers:tartanVotes/${dancerId}`);
  await votes.child(userId).set(isBuiltIn(pick) ? pick : null);
  const snap = await votes.once('value');
  const tartanId = consensus((snap.val() ?? {}) as Record<string, string>);
  const profile = db.child(`dancers:profiles/${dancerId}`);
  const current = (await profile.child('tartanId').once('value')).val();
  if (current === tartanId) return;
  await profile.set(tartanId ? { tartanId, updatedAt: Date.now() } : null);
}
