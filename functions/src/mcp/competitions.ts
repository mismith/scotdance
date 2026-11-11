import type { Session } from './session';

/** The few fields get_competitions gives for each competition */
export interface CompetitionRow {
  id: string;
  name: string;
  date: string | number | null;
  venue: string | null;
  listed: boolean;
  published: boolean;
}

/** How many competitions are read at once */
const AT_ONCE = 10;

/**
 * The competitions the person manages: the ones `users:permissions/{uid}/competitions` names, each read from
 * `competitions/{id}`. Both reads go through the rules as the person, so a system admin's session (which has no
 * admin rights over the whole tree, see firebase.rules.json) lists exactly what they were made an admin of.
 */
export async function listCompetitions(session: Session): Promise<{ competitions: CompetitionRow[] }> {
  const permissions = (await session.read(`users:permissions/${session.uid}/competitions`)) as Record<string, unknown> | null;
  const ids = Object.entries(permissions ?? {}).filter(([, on]) => on === true).map(([id]) => id);
  const rows: CompetitionRow[] = [];
  for (let i = 0; i < ids.length; i += AT_ONCE) {
    const chunk = await Promise.all(ids.slice(i, i + AT_ONCE).map(async (id) => {
      const record = (await session.read(`competitions/${id}`)) as Record<string, unknown> | null;
      // A permission left behind by a competition that was deleted
      if (!record) return null;
      return {
        id,
        name: typeof record.name === 'string' ? record.name : '',
        date: typeof record.date === 'string' || typeof record.date === 'number' ? record.date : null,
        venue: typeof record.venue === 'string' ? record.venue : null,
        listed: record.listed === true,
        published: record.published === true,
      } satisfies CompetitionRow;
    }));
    rows.push(...chunk.filter((row): row is CompetitionRow => row !== null));
  }
  // Newest first: what is coming or just happened is what they ask about
  rows.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  return { competitions: rows };
}
