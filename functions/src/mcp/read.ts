import { ToolError } from './errors';
import { DatabaseError, type Session } from './session';
import { competitionSummary, type CompetitionContext, type Parts } from './view';

/** The sections of a competition's data a tool may need */
export type Part = keyof Parts;
export const ALL_PARTS: Part[] = ['categories', 'groups', 'dances', 'trophyEvents', 'dancers', 'staff', 'platforms', 'schedule', 'results', 'draws'];

/**
 * Reads some sections of a competition's data as the person. Reading goes through the rules, but a published
 * competition's sections are public, so the person's own permission is checked first: these tools are for what
 * they manage, not for any competition they could look at in the app.
 */
export async function loadParts(session: Session, competitionId: string, wanted: Part[]): Promise<Parts> {
  await assertManages(session, competitionId);
  try {
    const values = await Promise.all(wanted.map((part) => session.read(`competitions:data/${competitionId}/${part}`)));
    return Object.fromEntries(wanted.map((part, i) => [part, values[i] ?? undefined])) as Parts;
  } catch (error) {
    throw refused(error, competitionId);
  }
}

async function assertManages(session: Session, competitionId: string) {
  if (!/^[\w-]+$/.test(competitionId)) throw new ToolError('That is not a competition id. get_competitions lists yours.');
  const allowed = await session.read(`users:permissions/${session.uid}/competitions/${competitionId}`);
  if (allowed !== true) throw new ToolError(`You don’t manage a competition with the id ${competitionId}. get_competitions lists the ones you do.`);
}

/** The database saying no, as a sentence about this competition */
function refused(error: unknown, competitionId: string) {
  if (error instanceof DatabaseError && error.code === 'permission-denied') {
    return new ToolError(`ScotDance.app didn’t allow reading competition ${competitionId}. You can only see the competitions you are an admin of.`);
  }
  return error;
}

const today = () => new Date().toISOString().slice(0, 10);

/** get_competition: its details and a count per section */
export async function readCompetition(session: Session, competitionId: string, now: () => string = today) {
  const parts = await loadParts(session, competitionId, ALL_PARTS);
  try {
    const info = ((await session.read(`competitions/${competitionId}`)) ?? null) as Record<string, unknown> | null;
    if (!info) throw new ToolError(`There is no competition ${competitionId}.`);
    const [linkId, sync] = await Promise.all([
      session.read(`competitionLinks:of/${competitionId}`),
      session.read(`competitionLinks:sync/${competitionId}`),
    ]);
    const link = typeof linkId === 'string' ? ((await session.read(`competitionLinks/${linkId}`)) as { primary?: string; competitions?: Record<string, unknown> } | null) : null;
    const nameOf = async (id: string) => {
      const name = await session.read(`competitions/${id}/name`);
      return typeof name === 'string' ? name : '';
    };
    const orgIds = Object.keys((info.organisations as object) ?? {}).slice(0, 20);
    const linkedIds = Object.keys(link?.competitions ?? {}).slice(0, 12);
    const [orgNames, linkNames] = await Promise.all([
      Promise.all(orgIds.map(async (id) => {
        const name = await session.read(`organisations/${id}/name`);
        return [id, typeof name === 'string' ? name : ''] as const;
      })),
      Promise.all(linkedIds.map(async (id) => [id, await nameOf(id)] as const)),
    ]);
    const context: CompetitionContext = {
      id: competitionId,
      today: now(),
      info,
      organisations: Object.fromEntries(orgNames),
      link: link?.primary ? { primary: link.primary, competitions: Object.fromEntries(linkNames) } : null,
      sync: (sync as Record<string, unknown>) ?? {},
    };
    return competitionSummary(context, parts);
  } catch (error) {
    throw refused(error, competitionId);
  }
}

export { assertManages };

/** Which parts of this competition follow a primary one (ADR 0007), and the primary's name */
export async function readLinkLocks(session: Session, competitionId: string): Promise<{ sync: Record<string, boolean>; primary: string }> {
  const sync = ((await session.read(`competitionLinks:sync/${competitionId}`)) ?? {}) as Record<string, unknown>;
  const synced = Object.fromEntries(Object.entries(sync).map(([k, v]) => [k, v === true]));
  if (!Object.values(synced).some(Boolean)) return { sync: synced, primary: '' };
  const linkId = await session.read(`competitionLinks:of/${competitionId}`);
  const link = typeof linkId === 'string' ? ((await session.read(`competitionLinks/${linkId}`)) as { primary?: string } | null) : null;
  const name = link?.primary ? await session.read(`competitions/${link.primary}/name`) : null;
  return { sync: synced, primary: typeof name === 'string' && name ? name : 'the primary competition' };
}
