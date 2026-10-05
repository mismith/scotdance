import { ServerValue } from 'firebase-admin/database';

// The app keeps a copy of each competition it reads and re-uses it until the
// competition changes, so these stamp when that was, part by part: its
// details, and each section of its data (dancers, results, schedule…), at
// /competitions:changed/{competitionId}/{part}. A result going in only
// stamps `results`, so the app re-reads just that.
export function getOnChange(db: any, partOf: (params: Record<string, string>) => string) {
  return async (_change: unknown, ctx: any) => {
    const { competitionId } = ctx.params;
    await db.child(`competitions:changed/${competitionId}/${partOf(ctx.params)}`).set(ServerValue.TIMESTAMP);
  };
}
