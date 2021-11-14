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
