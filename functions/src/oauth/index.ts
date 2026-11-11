import { Router, type Request, type RequestHandler } from 'express';
import { revocationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/revoke.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { issuer, resource } from '../mcp/config';
import { SCOPE } from './common';
import { authorize } from './authorize';
import { limit } from './limit';
import { provider } from './provider';

export { bearerMisses } from './limit';
export { verifyAccessToken } from './verify';

const SCOPES = [SCOPE];

/** RFC 9728: what the MCP endpoint is and who vouches for tokens to it */
export const protectedResourceMetadata = () => ({
  resource: resource(),
  authorization_servers: [issuer()],
  scopes_supported: SCOPES,
  bearer_methods_supported: ['header'],
  resource_name: 'ScotDance.app',
});

/** RFC 8414, plus Client ID Metadata Document support. No registration endpoint: clients aren't registered. */
export const authorizationServerMetadata = () => ({
  issuer: issuer(),
  authorization_endpoint: `${issuer()}/oauth/authorize`,
  token_endpoint: `${issuer()}/oauth/token`,
  revocation_endpoint: `${issuer()}/oauth/revoke`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  revocation_endpoint_auth_methods_supported: ['none'],
  scopes_supported: SCOPES,
  client_id_metadata_document_supported: true,
});

/**
 * The SDK's handlers read `req.body` as a parsed form. Behind Cloud Functions the framework has parsed it
 * already (and body-parser would then wait for a stream that's gone); in a plain server nothing has.
 * Telling body-parser it's done when a body is there lets the same handlers work in both.
 */
const bodyOnce: RequestHandler = (req, _res, next) => {
  if (req.body !== undefined) (req as Request & { _body?: boolean })._body = true;
  next();
};

/** A request that fails unexpectedly says so plainly, without a stack trace */
const guarded = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error('oauth failed', error instanceof Error ? error.name : 'unknown');
    if (!res.headersSent) res.status(500).json({ error: 'server_error', error_description: 'Something went wrong.' });
  }
};

/** /.well-known/oauth-* and /oauth/*: ScotDance.app's small authorization server (ADR 0018) */
export function oauthRouter(): Router {
  const router = Router();
  const json = (make: () => object): RequestHandler => (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json(make());
  };
  router.get('/.well-known/oauth-protected-resource', json(protectedResourceMetadata));
  router.get('/.well-known/oauth-protected-resource/mcp', json(protectedResourceMetadata));
  router.get('/.well-known/oauth-authorization-server', json(authorizationServerMetadata));

  // Per caller 60, and 300 for everyone: the global cap is what holds if a caller invents addresses (see who)
  router.use('/oauth/authorize', limit(60, 15 * 60_000, 300), guarded(authorize));
  // Busy assistants share a few addresses, so this is generous; the SDK's own limiter is off (see limit.ts)
  router.use('/oauth/token', limit(1000), bodyOnce, tokenHandler({ provider, rateLimit: false }));
  router.use('/oauth/revoke', limit(1000), bodyOnce, revocationHandler({ provider, rateLimit: false }));
  return router;
}
