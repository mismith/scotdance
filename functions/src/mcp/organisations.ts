import { z } from 'zod';
import { LINK_PROBLEM, looksLikeLink } from '../../../shared/links';
import { commitOrganisationChange, type Updates } from './changes';
import { ToolError } from './errors';
import { pushId } from './ids';
import { readLinkLocks } from './read';
import type { Session } from './session';
import { defineTool, READ, WRITE, type Json, type Tool } from './toolkit';
import { isoDate, pick } from './view';

type Rec = Record<string, unknown>;

/** The most competitions one call adds or takes off (each is a record of the log, and a write that sets off triggers) */
export const MAX_COMPETITIONS = 40;
/** Competitions listed for each organisation */
const LISTED = 60;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const trimmed = (v: unknown) => str(v).trim();
const nullable = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : v.trim() || null);

// ---------- reading

interface OrganisationRow {
  id: string;
  name: string;
  shortName: string | null;
  location: string | null;
  website: string | null;
  description: string | null;
  links: Array<{ id: string; label: string | null; url: string | null }>;
  hasLogo: boolean;
}

const clip = (s: string, max = 600) => (s.length > max ? `${s.slice(0, max)}… (${s.length - max} more characters)` : s);

const rowOf = (id: string, o: Rec): OrganisationRow => ({
  id,
  name: str(o.name),
  shortName: str(o.shortName) || null,
  location: str(o.location) || null,
  website: str(o.website) || null,
  description: str(o.description) ? clip(str(o.description)) : null,
  links: Object.entries((o.links ?? {}) as Record<string, Rec>)
    .filter(([, l]) => l && typeof l === 'object')
    .sort(([, a], [, b]) => ((a._order as number) ?? Infinity) - ((b._order as number) ?? Infinity))
    .map(([lid, l]) => ({ id: lid, label: str(l.name) || null, url: str(l.url) || null })),
  hasLogo: !!str(o.image),
});

/** The organisations the person is an admin of, as the rules let them read them */
export async function managedOrganisations(session: Session): Promise<Array<{ id: string; record: Rec }>> {
  const permissions = (await session.read(`users:permissions/${session.uid}/organisations`)) as Record<string, unknown> | null;
  const ids = Object.entries(permissions ?? {}).filter(([, on]) => on === true).map(([id]) => id);
  const records = await Promise.all(ids.map(async (id) => [id, (await session.read(`organisations/${id}`)) as Rec | null] as const));
  // (A permission left behind by an organisation that was deleted is skipped)
  return records.filter((r): r is readonly [string, Rec] => !!r[1]).map(([id, record]) => ({ id, record }));
}

/** One of the organisations they manage, by id or name */
export async function managedOrganisation(session: Session, given: string): Promise<{ id: string; record: Rec }> {
  const all = await managedOrganisations(session);
  if (!all.length) throw new ToolError('You aren’t an admin of any organisation. get_organisations lists the ones you are.');
  const items = all.map((o) => ({ id: o.id, label: str(o.record.name) }));
  const found = pick(items, given, (i) => i.label, 'organisation');
  return all.find((o) => o.id === found.id)!;
}

const today = () => new Date().toISOString().slice(0, 10);

/** get_organisations */
export async function readOrganisations(session: Session, opts: { organisation?: string; from?: string }, now: () => string = today): Promise<Json> {
  const all = await managedOrganisations(session);
  const chosen = opts.organisation ? [await managedOrganisation(session, opts.organisation)] : all;
  const from = opts.from ?? `${Number(now().slice(0, 4)) - 1}${now().slice(4)}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new ToolError('from is a date, YYYY-MM-DD.');
  // Competitions list their organisations, not the other way round: read those from a date on, keep the ones that name theirs
  const [competitions, mine] = chosen.length
    ? await Promise.all([
      session.read('competitions', { orderBy: 'date', startAt: from }) as Promise<Record<string, Rec> | null>,
      session.read(`users:permissions/${session.uid}/competitions`) as Promise<Record<string, unknown> | null>,
    ])
    : [null, null];
  return {
    today: now(),
    competitionsFrom: from,
    organisations: chosen.map(({ id, record }) => {
      const theirs = Object.entries(competitions ?? {})
        .filter(([, c]) => c && (c.organisations as Rec | undefined)?.[id] === true)
        .map(([cid, c]) => ({ id: cid, name: str(c.name), date: isoDate(c.date), location: str(c.location) || null, listed: c.listed === true, published: c.published === true, yours: mine?.[cid] === true }))
        .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
      return {
        ...rowOf(id, record),
        competitions: theirs.slice(0, LISTED),
        ...(theirs.length > LISTED ? { competitionsNote: `${theirs.length - LISTED} more, older ones not shown: pass from to start later.` } : {}),
      };
    }),
  };
}

// ---------- update_organisation

export interface OrganisationInput {
  name?: string;
  shortName?: string | null;
  location?: string | null;
  website?: string | null;
  description?: string | null;
  links?: Array<{ id?: string; label?: string | null; url?: string }>;
  removeLinks?: string[];
  addCompetitions?: string[];
  removeCompetitions?: string[];
}

const FIELDS = [['name', 'Name'], ['shortName', 'Short name'], ['location', 'Based in'], ['website', 'Website'], ['description', 'Description']] as const;

const linkOk = (v: string) => {
  if (!looksLikeLink(v)) throw new ToolError(`“${v}”: ${LINK_PROBLEM}`);
  return v;
};

export interface Planned {
  writes: Updates;
  before: Record<string, unknown>;
  said: string[];
  warnings: string[];
  created: Array<{ kind: string; id: string; name: string }>;
}

/** What an edit to an organisation writes, worked out as Manage does: its fields, its links, and its place on competitions */
export async function planOrganisation(session: Session, organisation: { id: string; record: Rec }, input: OrganisationInput, newId: () => string = pushId): Promise<Planned> {
  const { id: oid, record } = organisation;
  const out: Planned = { writes: {}, before: {}, said: [], warnings: [], created: [] };
  const set = (path: string, value: unknown, was: unknown) => {
    out.writes[path] = value;
    out.before[path] = was;
  };

  for (const [key, label] of FIELDS) {
    const raw = input[key];
    if (raw === undefined) continue;
    const value = nullable(raw);
    if (key === 'name' && !value) throw new ToolError('The name can’t be empty.');
    if (key === 'website' && value) linkOk(value);
    set(`organisations/${oid}/${key}`, value, record[key]);
    out.said.push(`changed ${label.toLowerCase()}`);
  }

  const links = (record.links ?? {}) as Record<string, Rec>;
  let order = Object.values(links).reduce((max, l) => Math.max(max, typeof l?._order === 'number' ? l._order : -1), -1) + 1;
  for (const link of input.links ?? []) {
    if (link.id) {
      const have = links[link.id];
      if (!have) throw new ToolError(`There is no link ${link.id} on this organisation. Leave the id out to add a link.`);
      if (link.label !== undefined) set(`organisations/${oid}/links/${link.id}/name`, nullable(link.label), have.name);
      if (link.url !== undefined) {
        const url = trimmed(link.url);
        if (!url) throw new ToolError('The link can’t be empty.');
        set(`organisations/${oid}/links/${link.id}/url`, linkOk(url), have.url);
      }
      out.said.push(`changed link ${str(have.name) || str(have.url)}`);
    } else {
      const url = trimmed(link.url);
      if (!url) throw new ToolError('A new link needs its address.');
      const lid = newId();
      set(`organisations/${oid}/links/${lid}`, { name: nullable(link.label) ?? null, url: linkOk(url), _order: order++ }, undefined);
      out.created.push({ kind: 'link', id: lid, name: trimmed(link.label) || url });
      out.said.push('added a link');
    }
  }
  for (const lid of input.removeLinks ?? []) {
    const have = links[lid];
    if (!have) throw new ToolError(`There is no link ${lid} on this organisation.`);
    set(`organisations/${oid}/links/${lid}`, null, have);
    out.said.push(`removed link ${str(have.name) || str(have.url)}`);
  }

  // The competitions it has: Manage's "Add a competition" and "Take off"
  const adding = [...new Set(input.addCompetitions ?? [])];
  const removing = [...new Set(input.removeCompetitions ?? [])];
  if (adding.some((c) => removing.includes(c))) throw new ToolError('A competition can’t be added and taken off in one call.');
  if (adding.length + removing.length > MAX_COMPETITIONS) {
    throw new ToolError(`One call can add or take off at most ${MAX_COMPETITIONS} competitions (so it can be logged and undone). Split it into smaller calls.`);
  }
  const added: string[] = [];
  const removed: string[] = [];
  for (const [list, on] of [[adding, true], [removing, false]] as const) {
    for (const cid of list) {
      if (!/^[\w-]+$/.test(cid)) throw new ToolError(`“${cid}” is not a competition id. get_competitions lists yours.`);
      const [name, has, locks] = await Promise.all([
        session.read(`competitions/${cid}/name`),
        session.read(`competitions/${cid}/organisations/${oid}`),
        readLinkLocks(session, cid),
      ]);
      if (typeof name !== 'string') throw new ToolError(`There is no competition ${cid}.`);
      if (locks.sync.organisations) {
        throw new ToolError(`The organisations of “${name}” are shared from ${locks.primary}, so they can only be changed there. Add the organisation to the main competition and it follows.`);
      }
      if (on && has === true) out.warnings.push(`“${name}” already has ${str(record.name)}.`);
      else if (!on && has !== true) out.warnings.push(`“${name}” does not have ${str(record.name)}.`);
      else {
        set(`competitions/${cid}/organisations/${oid}`, on ? true : null, has === true ? true : undefined);
        (on ? added : removed).push(name);
      }
    }
  }
  if (added.length) out.said.push(`added ${added.length === 1 ? added[0] : `${added.length} competitions`}`);
  if (removed.length) out.said.push(`took ${removed.length === 1 ? removed[0] : `${removed.length} competitions`} off`);
  return out;
}

const organisation = z.string().min(1).describe('The organisation’s id or name (from get_organisations)');
const clearable = (what: string) => z.string().nullable().optional().describe(`${what}. Pass null or "" to clear it. Leave out to keep it.`);

/** What the callable keeps of each (it cuts longer text short); a tool refuses instead, so nothing is changed silently */
const LIMITS = { name: 120, shortName: 24, location: 120, website: 300 } as const;
const LIMIT_WORDS = { name: 'The name', shortName: 'The short name', location: 'The place', website: 'The website' } as const;

export const organisationTools = [
  defineTool({
    name: 'get_organisations',
    title: 'Get my organisations',
    description:
      'The organisations this person is an admin of (an association, games society or series): id, name, short name, where it is based, '
      + 'website, description, links, and the competitions it has (id, name, date, town, and whether they manage that competition), from a year ago on by default.',
    input: {
      organisation: z.string().optional().describe('One organisation, by id or name'),
      from: z.string().optional().describe('List competitions from this date, YYYY-MM-DD (default: a year ago)'),
    },
    annotations: READ,
    run: ({ organisation: o, from }, session) => readOrganisations(session, { organisation: o, from }),
  }),
  defineTool({
    name: 'update_organisation',
    title: 'Change an organisation’s page, or the competitions it has',
    description:
      'Change an organisation they are an admin of, as its Manage page does: name, short name, where it is based, website, description, links, '
      + 'and add or take off competitions (by id; `addCompetitions` puts the organisation on a competition, which then shows it, and any competition can be '
      + 'added, as the app allows; `removeCompetitions` takes it off). Only what you pass changes. Text is saved exactly as given. Links and the '
      + 'logo cannot be uploaded here. A competition that takes its organisations from a primary one is changed on the primary. Changes are live '
      + 'at once and logged: undo_change with the organisation puts them back. Inviting or removing admins is not possible here.',
    input: {
      organisation,
      name: z.string().optional().describe('The organisation’s name'),
      shortName: clearable('What people call it, like “FHDA”'),
      location: clearable('Where it is based, like “Calgary, AB”'),
      website: clearable('Its website'),
      description: clearable('Plain-text description shown on its page'),
      links: z
        .array(z.object({ id: z.string().optional().describe('A link’s id, to change it. Leave out to add one.'), label: clearable('The button’s label'), url: z.string().optional().describe('The address (needed for a new link)') }))
        .optional(),
      removeLinks: z.array(z.string()).optional().describe('Ids of links to remove'),
      addCompetitions: z.array(z.string()).max(MAX_COMPETITIONS).optional().describe('Ids of competitions to put it on'),
      removeCompetitions: z.array(z.string()).max(MAX_COMPETITIONS).optional().describe('Ids of competitions to take it off'),
    },
    annotations: { ...WRITE, idempotentHint: true },
    run: async ({ organisation: given, ...input }, session) => {
      const found = await managedOrganisation(session, given);
      const planned = await planOrganisation(session, found, input);
      const said = planned.said.join(', ');
      const summary = said ? `${said.charAt(0).toUpperCase()}${said.slice(1)}.` : 'Nothing to change.';
      const committed = await commitOrganisationChange(session, {
        organisation: found.id,
        tool: 'update_organisation',
        summary: `${str(found.record.name)}: ${summary}`,
        writes: planned.writes,
        before: planned.before,
      });
      if (!committed) return { summary: 'Nothing needed changing: it is already as asked.', ...(planned.warnings.length ? { warnings: planned.warnings } : {}), note: 'unchanged' };
      return {
        summary,
        ...(planned.created.length ? { created: planned.created } : {}),
        ...(planned.warnings.length ? { warnings: planned.warnings } : {}),
        change: committed.id,
        undo: `undo_change with organisation ${found.id} and change ${committed.id} puts it back`,
      };
    },
  }),
  defineTool({
    name: 'create_organisation',
    title: 'Start an organisation',
    description:
      'Start a new organisation (an association, games society or series) with the person as its admin, as Add an organisation does. Needs a name; '
      + 'optional short name (up to 24 characters; two organisations may share one), where it is based, website, and a competition they manage to put it on. '
      + 'Refused if an organisation with the same full name exists. It CANNOT BE UNDONE or removed from here, so confirm the exact name with the '
      + 'organiser first. Only someone who already manages a competition or an organisation can start one.',
    input: {
      name: z.string().min(1).describe('The full name'),
      shortName: z.string().optional().describe('What people call it, up to 24 characters'),
      location: z.string().optional().describe('Where it is based, like “Calgary, AB”'),
      website: z.string().optional().describe('Its website'),
      competition: z.string().optional().describe('A competition they manage to put it on (id)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: async ({ name, shortName, location, website, competition }, session) => {
      if (!session.createOrganisation) throw new ToolError('Starting an organisation isn’t available here.');
      const given = { name: name.trim(), shortName: shortName?.trim(), location: location?.trim(), website: website?.trim() };
      for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
        if ((given[key]?.length ?? 0) > LIMITS[key]) throw new ToolError(`${LIMIT_WORDS[key]} can be at most ${LIMITS[key]} characters.`);
      }
      if (!given.name) throw new ToolError('An organisation needs a name.');
      if (given.website) linkOk(given.website);
      try {
        const { organisationId } = await session.createOrganisation({ ...given, ...(competition ? { competitionId: competition } : {}) });
        return {
          summary: `Started ${given.name}. They are its admin.`,
          created: [{ kind: 'organisation', id: organisationId, name: given.name }],
          note: 'Not logged for undo: an organisation cannot be removed from here.',
        };
      } catch (error) {
        const e = error as { message?: unknown; code?: unknown };
        if (typeof e?.code === 'string' && /^(already-exists|permission-denied|failed-precondition|invalid-argument|not-found)$/.test(e.code) && typeof e.message === 'string' && e.message) {
          throw new ToolError(e.message);
        }
        throw error;
      }
    },
  }),
] as unknown as Array<Tool<z.ZodRawShape>>;
