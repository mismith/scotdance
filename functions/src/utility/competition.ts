import { https } from 'firebase-functions';

export async function attachUserToCompetition({
  db,
  userId,
  competitionId,
  value = true,
}) {
  if (!(db && userId && competitionId)) {
    throw new Error('missing required props');
  }

  return db.update({
    [`users:permissions/${userId}/competitions/${competitionId}`]: value,
    [`competitions:permissions/${competitionId}/users/${userId}`]: value,
  });
}

export async function ensureAdmin(ctx, db) {
  if (!ctx.auth?.uid) throw new https.HttpsError('unauthenticated', '');
  const isAdmin = (await db.child(`users:permissions/${ctx.auth.uid}/admin`).get())
    .val() === true;
  if (!isAdmin) throw new https.HttpsError('permission-denied', '');
}
