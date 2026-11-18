/** Preserve the original request and completed state when Firebase retries an Auth event. */
const queue = (db, tool, uid) => db.child(`${tool}:accountDeletions/${uid}`)
  .transaction((previous) => previous ?? { deletedAt: Date.now(), state: 'pending' });

exports.queueAccountDeletion = async (db, uid) => {
  await queue(db, 'entries', uid);
  // Each tool has its own queue, so one tool's failure never blocks the others.
  await Promise.all([queue(db, 'binder', uid), queue(db, 'challenge', uid)]);
};
