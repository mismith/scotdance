/** Preserve the original request and completed state when Firebase retries an Auth event. */
exports.queueAccountDeletion = async (db, uid) => {
  await db.child(`entries:accountDeletions/${uid}`)
    .transaction((previous) => previous ?? { deletedAt: Date.now(), state: 'pending' });
};
