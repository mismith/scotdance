import { z } from 'zod';
import { MAX_RECORDS, recentChanges, undoChange, type Scope } from './changes';
import { managedOrganisation } from './organisations';
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
import { resultsOf } from '../../../shared/plans';
import { called, model, placed, type Parts } from './view';
import { planDraws, DRAW_ACTIONS, drawOf } from './writeDraws';
import { planResults } from './writeResults';
import { planSchedule } from './writeSchedule';

const competition = z.string().min(1).describe('The competition’s id (from get_competitions)');
const organisationRef = z.string().min(1).describe('The organisation’s id or name (from get_organisations), for changes to an organisation');

/** Whose log: a competition they manage, or an organisation they are an admin of (exactly one) */
async function scopeFor(session: Session, competitionId?: string, organisationId?: string): Promise<Scope> {
  if (!!competitionId === !!organisationId) throw new ToolError('Say whose changes: pass competition, or organisation, not both.');
  if (competitionId) {
    await assertManages(session, competitionId);
    return { kind: 'competition', id: competitionId };
  }
  return { kind: 'organisation', id: (await managedOrganisation(session, organisationId!)).id };
}
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
  allowSameName = false,
): Promise<Json> {
  const loaded = await loadState(session, competitionId, sections);
  const work = new Work(loaded.state);
  work.allowSameName = allowSameName;
  const said = plan(work);
  return answer(await finish(session, competitionId, tool, loaded, work, say(said, 'Nothing to change.')));
}

/** Like `change`, for a tool that also reads back what it saved */
async function changeAndShow<T>(
  session: Session,
  competitionId: string,
  tool: string,
  sections: readonly string[],
  plan: (work: Work, date: unknown) => { said: string[]; targets: T[] },
  show: (work: Work, targets: T[]) => Json,
): Promise<Json> {
  const loaded = await loadState(session, competitionId, sections);
  const work = new Work(loaded.state);
  const { said, targets } = plan(work, loaded.state.info?.date);
  const done = await finish(session, competitionId, tool, loaded, work, say(said, 'Nothing to change.'));
  return { ...answer(done), ...show(work, targets) };
}

const RESULT_PARTS = ['categories', 'groups', 'dances', 'trophyEvents', 'dancers', 'results', 'points'] as const;
const DRAW_PARTS = ['categories', 'groups', 'dances', 'dancers', 'draws'] as const;
const SCHEDULE_PARTS = ['categories', 'groups', 'dances', 'trophyEvents', 'staff', 'platforms', 'schedule'] as const;

const given = z.union([z.string(), z.number()]);
const cellRef = z.union([
  z.string(),
  z.object({ id: z.string().optional(), name: z.string().nullable().optional(), gap: z.boolean().optional() }),
]);

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
      + 'Names and steps are saved exactly as given: “Highland Fling” with steps “4”. The same dance at different steps (“Highland Fling” 4 and 6) is normal and fine; only the same name AND steps together is refused as a duplicate.',
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
      allowSameName: z.boolean().optional().describe('Only when the organiser says two trophy events really share a name. Without it a trophy event with the name of an existing one (added, or by renaming) is refused, which stops a retried call adding it twice.'),
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
    run: ({ competition: c, allowSameName, ...input }, session) =>
      change(session, c, 'save_dances', WRITE_PARTS, (work) => planDances(work, input), allowSameName),
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
      allowSameName: z.boolean().optional().describe('Only when the organiser says two people with the same role and name really are two people. Without it a second one (added, or by renaming) is refused, which stops a retried call adding them twice.'),
      platforms: z
        .array(z.object({ id: id('A platform'), name: z.string().optional(), description: clearable('Where it is') }))
        .max(MAX_RECORDS)
        .optional(),
    },
    annotations: WRITE,
    run: ({ competition: c, allowSameName, ...input }, session) =>
      change(session, c, 'save_staff', WRITE_PARTS, (work) => planStaff(work, input), allowSameName),
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
    name: 'save_results',
    title: 'Enter results',
    description:
      'Enter the results of one or more rows, each an age group’s callbacks, a dance, or its overall, or a trophy event’s callbacks (only if '
      + 'danced) or placings (row “overall”). Give numbers in placing order, 1st first, as the results sheet reads: '
      + '["101","214",["105","99"],"150"] means 101 first, 214 second, 105 and 99 tied for third, 150 fifth. Callbacks are a flat list of who was called back. '
      + 'A championship announced from the bottom: pass reversedFrom (6 = “from 6th up to 1st”) and list numbers in the order announced, lowest place first. '
      + 'get_results gives each row’s “numbers” (and “reversedFrom”) in exactly this shape. noResults: true marks a dance “no results” '
      + '(for callbacks: “no callback round”). points sets who got a championship point in a dance or overall (not for Primary). '
      + 'Numbers are the entries’ numbers in that age group (for a trophy event, in the age groups it is open to); an entry id also works. '
      + '“?” (a stand-in for a missed number) is only accepted with allowStandIns: true, which is for when the organiser asked for it. '
      + 'It refuses, in a sentence, a number that is not an entry there, a dancer placed twice, a dance that age group does not dance, '
      + 'and (as the app does) anyone not called back once callbacks are entered. SAVING A ROW REPLACES IT: its whole list, reversedFrom '
      + 'and noResults mark; an empty numbers list clears it; leave numbers out to change only reversedFrom or points. '
      + 'LIVE AND PUBLIC AT ONCE: on a published competition, results are visible to everyone the moment they are saved, and on the day '
      + '(competition date ±1 day) followers of the dancers placed are sent a push alert about a minute later, if the row has not changed again. '
      + 'Callbacks and points never send alerts. Read the placings back to the organiser and get a yes before saving, unless they gave the exact '
      + 'placings. If one is wrong, fix it straight away (a corrected save inside the minute means the wrong alert is never sent); undo_change also works. '
      + 'Not read-only and not idempotent. The reply shows what was saved, with names, as get_results would.',
    input: {
      competition,
      rows: z
        .array(z.object({
          ageGroup: z.string().optional().describe('The age group (id or name). Give this or trophyEvent.'),
          trophyEvent: z.string().optional().describe('The trophy event (id or name)'),
          row: z.string().describe('“callbacks”, “overall”, or a dance (id or name) the age group dances'),
          numbers: z.array(z.union([given, z.array(given)])).optional().describe('Placing order; an inner list is a tie'),
          reversedFrom: z.number().int().nullable().optional().describe('Places announced from this one up to 1st (2 to 20). null turns it off.'),
          noResults: z.boolean().optional().describe('Mark none placed (for callbacks, no callback round); false clears the mark'),
          points: z.array(given).optional().describe('Numbers given a championship point in this dance or overall'),
          allowStandIns: z.boolean().optional().describe('Accept “?” in numbers and points. Only when the organiser asked for it.'),
        }))
        .min(1)
        .max(60),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: ({ competition: c, rows }, session) =>
      changeAndShow(
        session, c, 'save_results', RESULT_PARTS,
        (work) => planResults(work, rows),
        (work, targets) => {
          const dancers = new Map(model(work.state.data as Parts).dancers.map((d) => [d.id, d]));
          const results = resultsOf(work.state.data);
          return {
            saved: targets.map((t) => {
              const raw = results[t.group]?.[t.row];
              return { in: t.subject, row: t.step, ...(t.row === 'callbacks' ? called(raw, dancers) : placed(raw, dancers)) };
            }),
          };
        },
      ),
  }),
  defineTool({
    name: 'save_draws',
    title: 'Set the draw (dancing order)',
    description:
      'Set the order dancers go up in, for an age group’s dance (stored as entry numbers). Each row names the ageGroup and the dance (or '
      + '“all” for every dance it does) and gives EITHER order (numbers, first to dance first; replaces that draw; [] clears it) OR an action: '
      + `${DRAW_ACTIONS.join(', ')}. shuffle makes a fresh random order (reels are always danced in number order, so they are put in number order instead), `
      + 'numberOrder sorts by number, addMissing puts entries not yet drawn at the end, removeStrays drops numbers no entry has any more, clear empties the draw. '
      + 'Replaces the existing draw. Not idempotent for shuffle. The reply gives the order saved. Draws are public once the competition is published.',
    input: {
      competition,
      draws: z
        .array(z.object({
          ageGroup: z.string().describe('The age group (id or name)'),
          dance: z.string().describe('A dance it does (id or name), or “all”'),
          order: z.array(given).optional(),
          action: z.enum(DRAW_ACTIONS).optional(),
        }))
        .min(1)
        .max(60),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: ({ competition: c, draws }, session) =>
      changeAndShow(
        session, c, 'save_draws', DRAW_PARTS,
        (work) => planDraws(work, draws),
        (work, targets) => ({ saved: targets.map((t) => ({ ageGroup: t.groupLabel, dance: t.danceLabel, order: drawOf(work, t) })) }),
      ),
  }),
  defineTool({
    name: 'save_schedule',
    title: 'Build or change the schedule',
    description:
      'Put whole days on the schedule. Send days in the shape get_schedule returns (read it, edit it, send it back): a day has sessions; a session has events; '
      + 'an event has dances (rows); a dance row has platforms, each with ageGroups (in running order) and judges. A day you send is saved EXACTLY as described: '
      + 'sessions, events, rows and cells you leave out are removed (ids you keep are kept; omit sessions to leave a day’s sessions alone; days you do not send are untouched). '
      + 'A day is found by id, else by the same date, else by the same name, else added (the next day after the last, if you give neither name nor date). '
      + 'Rows: a dance (danceId or its name) or, for Registration, March Past, Lunch and so on, just a name; only a dance has platforms. Times go in a session’s or event’s description (“9:00 am”). '
      + 'Platforms are named by id or name. ageGroups are ids or names, as in get_dances: an age group only goes with a dance it dances; a trophy event only with its own dance; '
      + '{ "gap": true } (or "gap") leaves a space between age groups. Judges must be Judges from get_staff. New ids are made for anything without one. '
      + 'One call can hold a full day (the size limit is about 500 KB of change; split by day if a call is refused as too big). Public once the competition is published. The reply says what was removed.',
    input: {
      competition,
      days: z
        .array(z.object({
          id: z.string().optional().describe('The day’s id, to change it'),
          name: z.string().optional().describe('Like “Saturday”'),
          date: z.string().optional().describe('YYYY-MM-DD'),
          description: z.string().optional(),
          sessions: z
            .array(z.object({
              id: z.string().optional(),
              name: z.string().describe('Like “Morning”'),
              description: z.string().optional(),
              events: z
                .array(z.object({
                  id: z.string().optional(),
                  name: z.string().describe('Like “Novice”, “Registration”, “Results”'),
                  description: z.string().optional().describe('Often the time, “9:00 am”'),
                  dances: z
                    .array(z.object({
                      id: z.string().optional(),
                      danceId: z.string().optional().describe('A dance’s id or name (from get_dances)'),
                      dance: z.string().optional().describe('Same as danceId; get_schedule shows the dance’s name here'),
                      name: z.string().optional().describe('A line that is not a dance, like “Registration”'),
                      description: z.string().optional(),
                      platforms: z
                        .array(z.object({
                          id: z.string().optional().describe('The platform’s id or name'),
                          platform: z.string().optional().describe('Same, by name'),
                          ageGroups: z.array(cellRef).optional(),
                          judges: z.array(cellRef).optional(),
                        }))
                        .optional(),
                    }))
                    .optional(),
                }))
                .optional(),
            }))
            .optional(),
        }))
        .min(1)
        .max(14),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: ({ competition: c, days }, session) =>
      changeAndShow(
        session, c, 'save_schedule', SCHEDULE_PARTS,
        (work, date) => planSchedule(work, days, date),
        (_work, targets) => ({ days: targets.map((t) => ({ id: t.day, name: t.label })), note: 'get_schedule reads it back.' }),
      ),
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
    description:
      'What assistants changed in a competition (pass competition) or in an organisation and the competitions it has (pass organisation) recently, newest first: id, when, '
      + 'which tool, a one-line summary, and whether it was undone. Kept 30 days.',
    input: { competition: competition.optional(), organisation: organisationRef.optional(), limit: z.number().int().min(1).max(30).optional() },
    annotations: READ,
    run: async ({ competition: c, organisation: o, limit }, session) => {
      const scope = await scopeFor(session, c, o);
      return { changes: await recentChanges(session, scope, limit ?? 10) };
    },
  }),
  defineTool({
    name: 'undo_change',
    title: 'Undo a change',
    description:
      'Put back what one change changed (ids from get_changes or from a write tool’s result; pass competition, or organisation for update_organisation’s). '
      + 'It only works if nothing it changed has been changed again since; otherwise it says what has, and changes nothing. The undo is logged too.',
    input: { competition: competition.optional(), organisation: organisationRef.optional(), change: z.string().min(1).describe('The change’s id') },
    annotations: REMOVE,
    run: async ({ competition: c, organisation: o, change: changeId }, session) => {
      const scope = await scopeFor(session, c, o);
      const done = await undoChange(session, scope, changeId);
      return { summary: `Undid: ${done.change}`, restored: done.restored, change: done.undoneBy };
    },
  }),
];

export const writeTools = tools as unknown as Array<Tool<z.ZodRawShape>>;
