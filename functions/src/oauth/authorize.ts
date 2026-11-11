import type { Request, RequestHandler, Response } from 'express';
import { redirectUriMatches } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { issuer, resource } from '../mcp/config';
import { getClient, summary } from './cimd';
import { isKnownClient } from './known';
import { REQUEST_TTL, SCOPE, later } from './common';
import { getStore, randomToken } from './runtime';
import { trimSlash } from './tokens';

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Before the redirect address is trusted we never redirect to it: a plain page says what went wrong */
function errorPage(res: Response, status: number, message: string): void {
  res
    .status(status)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
    })
    .send(
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>Can\'t connect</title><body style="font:16px system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">'
        + `<h1 style="font-size:1.25rem">Can't connect this assistant</h1><p>${escape(message)}</p>`
        + '<p>Go back to the assistant and try adding ScotDance.app again.</p></body></html>',
    );
}

/** The redirect back to the assistant with an error, once its address is trusted (RFC 6749 §4.1.2.1) */
function failBack(res: Response, redirectUri: string, state: string | undefined, error: string, description: string): void {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state !== undefined) url.searchParams.set('state', state);
  url.searchParams.set('iss', issuer());
  res.redirect(302, url.href);
}

/** One query parameter that must appear at most once, as plain text; undefined if absent */
function param(req: Request, name: string, max = 2048): string | undefined | null {
  const value = req.query[name];
  if (value === undefined) return undefined;
  return typeof value === 'string' && value.length <= max ? value : null;
}

/** GET /oauth/authorize: check the request, file it, and send the browser to the app's own /connect page */
export const authorize: RequestHandler = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.status(405).set('Allow', 'GET').json({ error: 'invalid_request', error_description: 'Use GET.' });
    return;
  }

  // Phase 1: who is asking, and where would we send the answer? Until both check out, no redirects.
  const clientId = param(req, 'client_id');
  const redirectUri = param(req, 'redirect_uri');
  if (!clientId || redirectUri === null) return errorPage(res, 400, 'The request is missing its client.');
  const client = await getClient(clientId);
  if (!client) return errorPage(res, 400, 'That assistant couldn\'t be identified.');
  if (!redirectUri || !client.redirect_uris.some((registered) => redirectUriMatches(redirectUri, registered))) {
    return errorPage(res, 400, 'That assistant\'s return address isn\'t one it registered.');
  }

  // Phase 2: the rest of the request. Errors go back to the assistant, but only one we know: anyone can
  // publish a client document, so for any other the redirect would be an open redirect to an address they chose.
  const state = param(req, 'state', 1024);
  const known = isKnownClient(clientId);
  const fail = (error: string, description: string) => (known
    ? failBack(res, redirectUri, typeof state === 'string' ? state : undefined, error, description)
    : errorPage(res, 400, description));
  if (state === null) return fail('invalid_request', 'state is not valid');

  const responseType = param(req, 'response_type');
  if (responseType !== 'code') return fail('unsupported_response_type', 'response_type must be code');
  const challenge = param(req, 'code_challenge');
  if (!challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return fail('invalid_request', 'A valid S256 code_challenge is required');
  if (param(req, 'code_challenge_method') !== 'S256') return fail('invalid_request', 'code_challenge_method must be S256');
  // The one MCP address (a trailing slash makes no difference)
  const asked = param(req, 'resource');
  if (asked === null || (asked !== undefined && trimSlash(asked) !== resource())) return fail('invalid_target', 'resource must be this server');
  // There is one scope and every connection gets it, so whatever is asked for, this is what is granted (ADR 0018)
  if (param(req, 'scope') === null) return fail('invalid_scope', 'scope is not valid');

  const id = randomToken();
  await getStore().set(`oauth:requests/${id}`, {
    id,
    client: summary(client),
    redirectUri,
    codeChallenge: challenge,
    scope: SCOPE,
    state,
    resource: resource(),
    createdAt: Date.now(),
    expiresAt: later(REQUEST_TTL),
  });
  res.redirect(302, `${issuer()}/connect?request=${id}`);
};
