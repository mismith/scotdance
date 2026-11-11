import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { listCompetitions } from './competitions';
import { DatabaseError, type Session } from './session';
import type { Access } from './types';

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

/** A problem to tell the assistant as it is (a wrong id, a missing field), not an unexpected failure */
export class ToolError extends Error {}

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
];

/** Every tool, for one session. More are added to the list above. */
export function registerTools(server: McpServer, access: Access, session: Session): void {
  void access;
  for (const tool of tools) register(server, session, tool as Tool<z.ZodRawShape>);
}
