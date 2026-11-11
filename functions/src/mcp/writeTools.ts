import { z } from 'zod';
import { MAX_RECORDS, recentChanges, undoChange } from './changes';
import { fileDraft, MAX_DRAFT_ENTRIES } from './draft';
import { assertManages } from './read';
import type { Session } from './session';
import { defineTool, READ, REMOVE, WRITE, type Json, type Tool } from './toolkit';
import {
  finish,
  loadState,
  planDances,
  planDancers,
  planDetails,
  planRemoval,
  planStaff,
  planVisibility,
  REMOVABLE,
  REMOVE_PARTS,
  ROLES,
  Work,
  WRITE_PARTS,
  type Done,
} from './write';
import { ToolError } from './errors';

const competition = z.string().min(1).describe('The competition’s id (from get_competitions)');
const id = (what: string) => z.string().optional().describe(`${what}’s id, to change it. Leave out to add a new one.`);
const clearable = (what: string) => z.string().nullable().optional().describe(`${what}. Pass null or "" to clear it. Leave out to keep it.`);
const ref = (what: string) => z.string().describe(`${what}: an id, or a name that picks out one`);
const agePick = z.union([z.literal('all'), z.array(z.string())]).optional();

/** What every write tool says back */
const answer = (done: Done): Json => ({
  summary: done.summary,
  ...(done.created.length ? { created: done.created } : {}),
  ...(done.warnings.length ? { warnings: done.warnings } : {}),
  ...(done.change ? { change: done.change, undo: `undo_change with change ${done.change} puts it back` } : {}),
});

const say = (said: string[], none: string) => {
  const line = said.join(', ');
  return said.length ? `${line.charAt(0).toUpperCase()}${line.slice(1)}.` : none;
};

/** Plan, write with the log entry in one update, and report */
async function change(
  session: Session,
  competitionId: string,
  tool: string,
  sections: readonly string[],
  plan: (work: Work) => string[],
): Promise<Json> {
  const loaded = await loadState(session, competitionId, sections);
  const work = new Work(loaded.state);
  const said = plan(work);
  return answer(await finish(session, competitionId, tool, loaded, work, say(said, 'Nothing to change.')));
}

const tools = [
  defineTool({
    name: 'update_competition',
    title: 'Change a competition’s details',
    description:
      'Change the name, date, venue, space, address, town, description, registration link and dates, and the links and files '
      + 'shown on the competition page. Only what you pass changes. Dates are YYYY-MM-DD; registration times YYYY-MM-DDTHH:mm. '
      + 'Text is saved exactly as given. It cannot move the map pin (that needs the venue search in the app): when the place '
      + 'changes, the result says so. Parts shared from a primary competition cannot be changed here. Changes are live at once.',
    input: {
      competition,
      name: z.string().optional().describe('The competition’s name'),
      date: z.string().optional().describe('The first day, YYYY-MM-DD'),
      venue: clearable('The venue’s name'),
      space: clearable('The hall or stage within the venue'),
      address: clearable('The street address'),
      location: clearable('Town or city, with the province or state, like “Calgary, AB”'),
      description: clearable('Plain-text description shown on the competition page'),
      registrationUrl: clearable('Where dancers register'),
      registrationOpens: clearable('When registration opens, YYYY-MM-DDTHH:mm'),
      registrationCloses: clearable('When registration closes, YYYY-MM-DDTHH:mm'),
      links: z
        .array(z.object({ id: id('A link'), label: clearable('The button’s label'), url: z.string().optional().describe('The address (needed for a new link)') }))
        .optional()
        .describe('Links to add or change. Files cannot be uploaded here.'),
      removeLinks: z.array(z.string()).optional().describe('Ids of links to remove'),
    },
    annotations: { ...WRITE, idempotentHint: true },
    run: ({ competition: c, ...input }, session) => change(session, c, 'update_competition', [], (work) => planDetails(work, input)),
  }),
  defineTool({
    name: 'set_visibility',
    title: 'List, publish or hide parts of a competition',
    description:
      'Listed: the competition shows in search. Published: its dancers’ names, schedule and results become public AND followers '
      + 'are alerted, so confirm with the organiser first. Unlisting also unpublishes; publishing also lists. Hiding the Schedule or '
      + 'Results tab DELETES what has been entered in it (undo_change can bring it back); that needs deleteContent: true, after the '
      + 'organiser agrees. Not read-only and not safe to repeat blindly: publishing again alerts nobody twice, but unpublishing hides it from the public.',
    input: {
      competition,
      listed: z.boolean().optional(),
      published: z.boolean().optional(),
      schedule: z.enum(['show', 'hide']).optional().describe('Show or hide the Schedule tab'),
      results: z.enum(['show', 'hide']).optional().describe('Show or hide the Results tab'),
      deleteContent: z.boolean().optional().describe('Required to hide a tab that has content: the organiser has agreed it is deleted'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: ({ competition: c, ...input }, session) =>
      change(session, c, 'set_visibility', ['schedule', 'results'], (work) => {
        const said = planVisibility(work, input);
        if (!said.length) throw new ToolError('Say what to change: listed, published, schedule or results.');
        return said;
      }),
  }),
  defineTool({
    name: 'save_dances',
    title: 'Save categories, age groups, dances and trophy events',
    description:
      'Add or change categories, age groups, dances and trophy events together (no id = add; an id = change only the fields given). '
      + 'Age groups name their category (id or name, added earlier in the same call is fine), trophy, sponsor (a Sponsor from save_staff) and '
      + 'notChampionship (only for championship age groups). A dance lists the age groups that dance it (“all”, or a list; it replaces '
      + 'who dances it). A trophy event lists the age groups that can win it. “order” puts the ids named first, in that order. '
      + 'Names and steps are saved exactly as given: “Highland Fling” with steps “4”. A second one with the same name is refused.',
    input: {
      competition,
      categories: z.array(z.object({ id: id('A category'), name: z.string().optional() })).optional(),
      ageGroups: z
        .array(z.object({
          id: id('An age group'),
          category: ref('The category').optional(),
          name: clearable('The age range, like “12 & Under 14 Years”; empty when the category is one group'),
          trophy: clearable('The trophy'),
          sponsor: z.string().nullable().optional().describe('The trophy’s sponsor: a Sponsor’s id or name. null clears.'),
          notChampionship: z.boolean().optional().describe('Ran as a regular competition: too few dancers for a championship'),
        }))
        .optional(),
      dances: z
        .array(z.object({
          id: id('A dance'),
          name: z.string().optional(),
          steps: z.union([z.string(), z.number()]).nullable().optional().describe('Steps, like “4” or “2+1”'),
          shortName: clearable('A short name for tight spaces'),
          ageGroups: agePick.describe('“all”, or the age groups (ids or names) that dance it'),
        }))
        .optional(),
      trophyEvents: z
        .array(z.object({
          id: id('A trophy event'),
          name: z.string().optional(),
          trophy: clearable('The trophy'),
          sponsor: z.string().nullable().optional().describe('A Sponsor’s id or name. null clears.'),
          dance: z.string().nullable().optional().describe('A dance (id or name) if it is danced on its own, like a Trophy Fling. null clears.'),
          ageGroups: agePick.describe('“all”, or the age groups whose dancers can win it'),
        }))
        .optional(),
      order: z
        .object({
          categories: z.array(z.string()).optional(),
          ageGroups: z.array(z.string()).optional(),
          dances: z.array(z.string()).optional(),
          trophyEvents: z.array(z.string()).optional(),
        })
        .optional(),
    },
    annotations: WRITE,
    run: ({ competition: c, ...input }, session) =>
      change(session, c, 'save_dances', WRITE_PARTS, (work) => planDances(work, input)),
  }),
  defineTool({
    name: 'save_dancers',
    title: 'Add or correct entries',
    description:
      `Add or correct up to ${MAX_RECORDS} entries (dancers, or duets, trios and groups) in one call. No id = add: it needs number and ageGroup, `
      + 'and firstName (or members for a duet, trio or group). With an id, only the fields given change; members replaces the whole team. '
      + 'Numbers are digits with an optional letter (101, 101A) and unique within an age group. Names, towns and studios are saved exactly '
      + 'as given: follow the list’s own spelling and capitals. For a whole list from a spreadsheet, use draft_dancers instead.',
    input: {
      competition,
      dancers: z
        .array(z.object({
          id: id('An entry'),
          number: z.union([z.string(), z.number()]).optional(),
          ageGroup: ref('The age group').optional(),
          firstName: z.string().optional(),
          lastName: clearable('Last name'),
          location: clearable('Where they are from'),
          studio: clearable('Their studio'),
          routine: clearable('The routine’s title'),
          members: z.array(z.object({ firstName: z.string(), lastName: z.string().nullable().optional() })).optional().describe('The dancers of a duet, trio or group'),
        }))
        .min(1)
        .max(MAX_RECORDS),
    },
    annotations: WRITE,
    run: ({ competition: c, dancers }, session) =>
      change(session, c, 'save_dancers', WRITE_PARTS, (work) => planDancers(work, dancers)),
  }),
  defineTool({
    name: 'save_staff',
    title: 'Save judges, pipers, volunteers, sponsors and platforms',
    description:
      'Add or change staff (role Judge, Piper, Volunteer or Sponsor; a sponsor’s organisation name goes in firstName) and platforms '
      + '(where dancing happens: name “A” shows as “Platform A”). No id = add; an id = change only the fields given. Saved exactly as given. '
      + 'Cannot upload photos or logos. A linked competition that shares its staff from a primary cannot change them here.',
    input: {
      competition,
      staff: z
        .array(z.object({
          id: id('A staff member'),
          role: z.enum(ROLES).optional(),
          firstName: clearable('First name (or a sponsor’s name)'),
          lastName: clearable('Last name'),
          location: clearable('Where they are from'),
          description: clearable('A short bio'),
          website: clearable('Their website'),
        }))
        .max(MAX_RECORDS)
        .optional(),
      platforms: z
        .array(z.object({ id: id('A platform'), name: z.string().optional(), description: clearable('Where it is') }))
        .max(MAX_RECORDS)
        .optional(),
    },
    annotations: WRITE,
    run: ({ competition: c, ...input }, session) =>
      change(session, c, 'save_staff', WRITE_PARTS, (work) => planStaff(work, input)),
  }),
  defineTool({
    name: 'remove',
    title: 'Remove categories, age groups, dances, trophy events, entries, staff or platforms',
    description:
      'Remove things by id, and what hangs off them: an age group takes its results, draws and place in the schedule; a dance takes its '
      + 'results and schedule slots; and so on (the result lists these as warnings). Confirm with the organiser first. undo_change can bring it back. '
      + 'Judges’ sheets (scans) are deleted for good, so a removal that would delete them is refused: it has to be done in the app.',
    input: {
      competition,
      what: z.enum(Object.keys(REMOVABLE) as [keyof typeof REMOVABLE, ...Array<keyof typeof REMOVABLE>]).describe('What kind of thing'),
      ids: z.array(z.string()).min(1).max(MAX_RECORDS),
    },
    annotations: REMOVE,
    run: async ({ competition: c, what, ids }, session) => {
      const loaded = await loadState(session, c, REMOVE_PARTS);
      const work = new Work(loaded.state);
      const { removed, summary } = planRemoval(work, what, ids);
      const done = await finish(session, c, 'remove', loaded, work, summary);
      return { ...answer(done), removed };
    },
  }),
  defineTool({
    name: 'draft_dancers',
    title: 'File a list of dancers for the organiser to import',
    description:
      'For a whole list read from a spreadsheet, PDF or photo. It changes nothing in the competition: it files the list in the organiser’s '
      + 'import inbox, and the result gives the page where they check the preview and press Import. Give category and ageGroup as the list '
      + 'writes them (“Premier”, “12 & Under 14 Years”); Import creates any the competition lacks. Names exactly as the list spells them. '
      + `Up to ${MAX_DRAFT_ENTRIES} entries.`,
    input: {
      competition,
      name: z.string().optional().describe('A file name to show in the inbox, like “Entries.csv”'),
      dancers: z
        .array(z.object({
          number: z.union([z.string(), z.number()]),
          category: z.string().optional(),
          ageGroup: z.string().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          location: z.string().optional(),
          studio: z.string().optional(),
          routine: z.string().optional(),
          members: z.array(z.object({ firstName: z.string(), lastName: z.string().optional() })).optional(),
        }))
        .min(1),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: ({ competition: c, name, dancers }, session) =>
      fileDraft(session, c, dancers.map((d) => ({ ...d, number: String(d.number) })), name),
  }),
  defineTool({
    name: 'get_changes',
    title: 'Get recent changes',
    description: 'What assistants changed in a competition recently, newest first: id, when, which tool, a one-line summary, and whether it was undone. Kept 60 days.',
    input: { competition, limit: z.number().int().min(1).max(30).optional() },
    annotations: READ,
    run: async ({ competition: c, limit }, session) => {
      await assertManages(session, c);
      return { changes: await recentChanges(session, c, limit ?? 10) };
    },
  }),
  defineTool({
    name: 'undo_change',
    title: 'Undo a change',
    description:
      'Put back what one change changed (ids from get_changes or from a write tool’s result). It only works if nothing it changed has been '
      + 'changed again since; otherwise it says what has, and changes nothing. The undo is logged too.',
    input: { competition, change: z.string().min(1).describe('The change’s id') },
    annotations: REMOVE,
    run: async ({ competition: c, change: changeId }, session) => {
      await assertManages(session, c);
      const done = await undoChange(session, c, changeId);
      return { summary: `Undid: ${done.change}`, restored: done.restored, change: done.undoneBy };
    },
  }),
];

export const writeTools = tools as unknown as Array<Tool<z.ZodRawShape>>;
