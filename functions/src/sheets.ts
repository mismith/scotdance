// Judges' sheets (ADR 0013): each page is a picture in Storage, under
// {env}/competitions/sheets/{competitionId}/, and a record in
// competitions:data/{competitionId}/sheets/{groupId}/{danceId}/{pageId}
// saying where its file is. The storage rules let organisers add files but
// never delete them, so deleting is done here: a page's file goes when its
// record does (one page, a dance, an age group, or the competition).

/** The bit of a Storage bucket used here (firebase-admin's, or a fake in tests). */
export interface Bucket {
  file(path: string): { delete(options: { ignoreNotFound: boolean }): Promise<unknown> };
  deleteFiles(options: { prefix: string; force: boolean }): Promise<unknown>;
}

const folder = (competitionId: string) => `competitions/sheets/${competitionId}/`;

/** Every file named in an age group's sheets ({ danceId: { pageId: { path } } }), if it's this competition's. */
export function sheetFiles(value: unknown, competitionId: string): Set<string> {
  const files = new Set<string>();
  if (!value || typeof value !== 'object') return files;
  for (const dance of Object.values(value as Record<string, unknown>)) {
    if (!dance || typeof dance !== 'object') continue;
    for (const page of Object.values(dance as Record<string, unknown>)) {
      const path = (page as { path?: unknown } | null)?.path;
      // The rules hold pages to their own competition's folder; check again
      // anyway, as this deletes whatever it's told to.
      if (typeof path === 'string' && path.startsWith(folder(competitionId)) && !path.includes('..')) files.add(path);
    }
  }
  return files;
}

/** On a write to an age group's sheets: delete the files of pages that are gone. */
export function getOnGroupSheetsWritten(env: string, bucket: () => Bucket) {
  return async (change: any, ctx: any) => {
    const { competitionId } = ctx.params;
    const after = sheetFiles(change.after.val(), competitionId);
    const gone = [...sheetFiles(change.before.val(), competitionId)].filter((path) => !after.has(path));
    await Promise.all(gone.map((path) => bucket().file(`${env}/${path}`).delete({ ignoreNotFound: true })));
  };
}

/** A deleted competition's whole folder, whatever its pages said. */
export function deleteCompetitionSheets(env: string, bucket: () => Bucket, competitionId: string) {
  return bucket().deleteFiles({ prefix: `${env}/${folder(competitionId)}`, force: true });
}
