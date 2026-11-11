import express from 'express';
import { bearerMisses, oauthRouter, verifyAccessToken } from '../oauth';
import { tooMany } from '../oauth/limit';
import { issuer } from './config';
import { handleMcp } from './server';
import type { Deps } from './session';

/** A JSON-RPC error body, as MCP clients expect from the endpoint */
const rpcError = (code: number, message: string) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

/** The one Express app behind the `mcp` function: the MCP endpoint and the OAuth server (ADR 0018) */
export function mcpApp(deps: Deps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // Made-up bearer tokens cost a database look-up each, so an address that sends too many is turned away
  const misses = bearerMisses();

  // Any origin may call it: browser-based assistants do, and a bearer token (not a cookie) is what authorises
  app.use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
      'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
      'Access-Control-Max-Age': '86400',
    });
    if (req.method === 'OPTIONS') res.status(204).end();
    else next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(oauthRouter());

  app.all('/mcp', async (req, res) => {
    // Stateless: there's no session to stream to or end
    if (req.method !== 'POST') {
      res.status(405).set('Allow', 'POST').json(rpcError(-32000, 'Method not allowed.'));
      return;
    }
    const bearer = /^Bearer (.+)$/i.exec(req.get('Authorization') ?? '');
    const wait = misses.blocked(req);
    if (bearer && wait) return void tooMany(res, wait);
    const access = bearer ? await verifyAccessToken(bearer[1].trim()) : null;
    if (!access) {
      if (bearer) misses.miss(req);
      const metadata = `resource_metadata="${issuer()}/.well-known/oauth-protected-resource/mcp"`;
      res
        .status(401)
        .set('WWW-Authenticate', bearer ? `Bearer ${metadata}, error="invalid_token"` : `Bearer ${metadata}`)
        .json({
          error: bearer ? 'invalid_token' : 'unauthorized',
          error_description: 'Connect this assistant to ScotDance.app first.',
        });
      return;
    }
    try {
      await handleMcp(req, res, deps, access);
    } catch (error) {
      console.error('mcp failed', error instanceof Error ? error.message : 'unknown');
      if (!res.headersSent) res.status(500).json(rpcError(-32603, 'Internal server error'));
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });
  return app;
}
