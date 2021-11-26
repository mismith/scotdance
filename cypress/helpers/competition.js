import seed from './seed';

export const COMPETITION_UID = {
  MISSING: 'MISSING',
  UNLISTED: 'UNLISTED',
  UNPUBLISHED: 'UNPUBLISHED',
  PUBLIC: 'PUBLIC',
};

export function createCompetition(uid) {
  return seed.database.set(`development/competitions/${uid}`, {
    name: `Competition ${uid}`,
    listed: uid === COMPETITION_UID.UNPUBLISHED || uid === COMPETITION_UID.PUBLIC || null,
    published: uid === COMPETITION_UID.PUBLIC || null,
  });
}
