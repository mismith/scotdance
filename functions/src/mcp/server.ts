import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { SERVER_VERSION } from './config';
import { INSTRUCTIONS } from './instructions';
import { sessionFor, type Deps } from './session';
import { registerTools } from './tools';
import type { Access } from './types';

/** One stateless MCP server per request, acting as the person through the database rules (ADR 0018) */
export async function handleMcp(req: Request, res: Response, deps: Deps, access: Access): Promise<void> {
  const server = new McpServer(
    { name: 'scotdance', version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );
  registerTools(server, access, sessionFor(deps, access));

  // Stateless, JSON responses (no SSE: Hosting rewrites buffer)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
