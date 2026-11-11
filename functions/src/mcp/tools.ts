import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ToolError } from './errors';
import { listCompetitions } from './competitions';
import { ALL_PARTS, loadParts, readCompetition, type Part } from './read';
import { DatabaseError, type Session } from './session';
import type { Access } from './types';
import { dancersView, dancesView, DANCER_CAP, findView, resultsView, scheduleView, staffView } from './view';

type Json = Record<string, unknown>;

const reply = (result: Json): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  structuredContent: result,
});
const problem = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
});

/** A failure said plainly: what is wrong and what to do next */
export function explain(error: unknown): string {
  if (error instanceof ToolError) return error.message;
  // The database rules said no: the person can't do this themselves
  if (error instanceof DatabaseError && error.code === 'permission-denied') {
    return 'ScotDance.app didn’t allow that. You can only manage the competitions and organisations you are an admin of.';
  }
  console.error('mcp tool failed', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown');
  return 'ScotDance.app couldn’t do that just now. Try again in a moment.';
}

export { ToolError };

/** Reads change nothing; writes change data but never delete or hand out access */
export const READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
export const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
/** For a tool that removes things (none yet) */
export const REMOVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

export interface Tool<S extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  /** The arguments, as a zod shape; each field described, for the assistant's sake */
  input: S;
  annotations: ToolAnnotations;
  run(args: z.infer<z.ZodObject<S>>, session: Session): Promise<Json>;
}

/** Declare a tool. Keeps the shape and the handler's types together. */
export const defineTool = <S extends z.ZodRawShape>(tool: Tool<S>) => tool;

/** Register a tool: its handler runs as the person (the session) and turns any failure into a sentence */
export function register<S extends z.ZodRawShape>(server: McpServer, session: Session, tool: Tool<S>): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.input,
      annotations: { title: tool.title, ...tool.annotations },
    },
    (async (args: z.infer<z.ZodObject<S>>) => {
      try {
        return reply(await tool.run(args, session));
      } catch (error) {
        return problem(explain(error));
      }
    }) as never,
  );
}

const competitionId = z.string().min(1).describe('The competition’s id (from get_competitions)');

const tools = [
  defineTool({
    name: 'get_competitions',
    title: 'Get my competitions',
    description:
      'The competitions this person manages: id, name, date, venue, and whether each is listed (shown in search) '
      + 'and published (results and entries visible to everyone). Start here to find a competition’s id.',
    input: {},
    annotations: READ,
    run: (_args, session) => listCompetitions(session),
  }),
  defineTool({
    name: 'get_competition',
    title: 'Get a competition',
    description:
      'One competition in full: name, date, venue, description, links, organisations, whether it is listed and published, '
      + 'whether its schedule and results tabs are hidden, how many of each thing it has (age groups, dances, entries, '
      + 'staff, schedule days, results entered), and if it is linked to others which parts follow the primary (and so '
      + 'cannot be changed here). Also today’s date.',
    input: { competition: competitionId },
    annotations: READ,
    run: ({ competition }, session) => readCompetition(session, competition),
  }),
  defineTool({
    name: 'get_dances',
    title: 'Get categories, age groups and dances',
    description:
      'How a competition is set up to be danced: categories, age groups (with category, trophy, sponsor, whether it ran as '
      + 'a championship, whether its entries are teams, how many entries, and which dances it does), dances (with the age '
      + 'groups that dance them) and trophy events. All in the order Manage shows them, with ids.',
    input: { competition: competitionId },
    annotations: READ,
    run: async ({ competition }, session) => dancesView(await loadParts(session, competition, ['categories', 'groups', 'dances', 'trophyEvents', 'staff', 'dancers'])),
  }),
  defineTool({
    name: 'get_dancers',
    title: 'Get entries',
    description:
      'The entries (dancers and teams) in a competition, by number: entry id, number, name, age group, location, studio, '
      + `routine title, and a team’s members. Up to ${DANCER_CAP} at a time: narrow with ageGroup, or page with offset.`,
    input: {
      competition: competitionId,
      ageGroup: z.string().optional().describe('An age group’s id or name, to list only its entries'),
      offset: z.number().int().min(0).optional().describe('How many entries to skip, to read the next page'),
    },
    annotations: READ,
    run: async ({ competition, ageGroup, offset }, session) => dancersView(await loadParts(session, competition, ['categories', 'groups', 'dancers']), ageGroup, offset),
  }),
  defineTool({
    name: 'get_staff',
    title: 'Get staff and platforms',
    description: 'A competition’s judges, pipers, volunteers and sponsors, and its platforms (where dancing happens), with ids.',
    input: { competition: competitionId },
    annotations: READ,
    run: async ({ competition }, session) => staffView(await loadParts(session, competition, ['staff', 'platforms'])),
  }),
  defineTool({
    name: 'get_schedule',
    title: 'Get the schedule',
    description:
      'The schedule: days, then sessions (blocks), events, dances, and for each dance on each platform the age groups '
      + 'in running order and the judges, as names with ids. Pass day to read one day.',
    input: {
      competition: competitionId,
      day: z.string().optional().describe('A day’s id or name, to read only that day'),
    },
    annotations: READ,
    run: async ({ competition, day }, session) => scheduleView(await loadParts(session, competition, ['categories', 'groups', 'dances', 'trophyEvents', 'platforms', 'staff', 'schedule']), day),
  }),
  defineTool({
    name: 'get_results',
    title: 'Get results',
    description:
      'Results: for each age group its callbacks, each dance’s placings and its overall, and trophy events’ placings, '
      + 'with dancers as number and name. Shows ties, reversed order, and “no results” or ? marks. Without ageGroup or '
      + 'trophyEvent it lists as many age groups as fit and summarises the rest. Pass draws to include dancing order.',
    input: {
      competition: competitionId,
      ageGroup: z.string().optional().describe('An age group’s id or name, to read only it'),
      trophyEvent: z.string().optional().describe('A trophy event’s id or name, to read only it'),
      draws: z.boolean().optional().describe('Also give each dance’s draw (the dancing order, by number)'),
    },
    annotations: READ,
    run: async ({ competition, ageGroup, trophyEvent, draws }, session) => {
      const wanted: Part[] = ['categories', 'groups', 'dances', 'trophyEvents', 'dancers', 'results', ...(draws ? (['draws'] as Part[]) : [])];
      return resultsView(await loadParts(session, competition, wanted), { ageGroup, trophyEvent, draws });
    },
  }),
  defineTool({
    name: 'find',
    title: 'Find in a competition',
    description:
      'Search one competition’s entries, staff, age groups, dances, trophy events and platforms by name or entry number '
      + '(accents and apostrophes don’t matter). Returns ids.',
    input: {
      competition: competitionId,
      query: z.string().min(1).describe('Part of a name, or an entry number'),
    },
    annotations: READ,
    run: async ({ competition, query }, session) => findView(await loadParts(session, competition, ALL_PARTS.filter((p) => !['schedule', 'results', 'draws'].includes(p))), query),
  }),
];

/** Every tool, for one session. More are added to the list above. */
export function registerTools(server: McpServer, access: Access, session: Session): void {
  void access;
  for (const tool of tools) register(server, session, tool as Tool<z.ZodRawShape>);
}
