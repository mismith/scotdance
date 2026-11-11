import type { LookupAddress } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { emulated } from '../mcp/config';
import { isPublicAddress } from './ip';
import { runtime } from './runtime';

/**
 * Clients name themselves with a Client ID Metadata Document: the `client_id` is an https address whose JSON
 * says who they are (ADR 0018). Fetching an address a stranger chose is the risky part, so it's guarded:
 * public addresses only (checked on the very connection we use, so DNS can't change its mind), https only,
 * 5 seconds, 32 KB, no redirects.
 */

const MAX_BYTES = 32 * 1024;
const GOOD_MS = 10 * 60_000;
const BAD_MS = 30_000;
const MAX_CACHED = 200;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** What the /connect page shows and the request stores */
export interface ClientSummary {
  id: string;
  name: string;
  uri?: string;
  logo?: string;
}

/**
 * Strip control characters, zero-width characters and bidi controls (they hide or reorder what a name says),
 * collapse whitespace, cap the length. Each becomes a space, so "Cl<hidden>aude" doesn't read as "Claude".
 */
const CONTROL = new RegExp(
  // eslint-disable-next-line no-control-regex -- the point is to match control characters
  '[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]',
  'g',
);
export const cleanName = (text: string) => text.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

const parseUrl = (text: unknown): URL | null => {
  if (typeof text !== 'string' || text.length > 2048) return null;
  try {
    return new URL(text);
  } catch {
    return null;
  }
};

/** In the emulator only, a local address is fine so the flow can be tried without the internet */
const localOk = (url: URL) =>
  emulated() && LOOPBACK.has(url.hostname) && (url.protocol === 'http:' || url.protocol === 'https:');

/** The client_id as a URL we'd fetch, or null */
export function clientIdUrl(clientId: string): URL | null {
  const url = parseUrl(clientId);
  if (!url || url.username || url.password || url.hash || clientId.includes('#')) return null;
  if (url.pathname === '/' || url.pathname === '') return null;
  if (url.protocol === 'https:') return url;
  return localOk(url) ? url : null;
}

/** A redirect address: https, or http for the machine's own loopback (RFC 8252); never custom schemes */
function redirectOk(text: unknown): text is string {
  const url = parseUrl(text);
  if (!url || url.username || url.password || url.hash) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK.has(url.hostname);
}

const httpsUrl = (text: unknown): string | undefined => {
  const url = parseUrl(text);
  return url && url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
};

/** Check a fetched document and turn it into client information, or null */
export function clientFromDocument(clientId: string, doc: unknown): OAuthClientInformationFull | null {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const d = doc as Record<string, unknown>;
  if (d.client_id !== clientId) return null;
  if (!Array.isArray(d.redirect_uris) || d.redirect_uris.length === 0 || d.redirect_uris.length > 20) return null;
  if (!d.redirect_uris.every(redirectOk)) return null;
  if (typeof d.client_name !== 'string') return null;
  const name = cleanName(d.client_name);
  if (!name) return null;
  const client_uri = d.client_uri === undefined ? undefined : httpsUrl(d.client_uri);
  const logo_uri = d.logo_uri === undefined ? undefined : httpsUrl(d.logo_uri);
  return {
    client_id: clientId,
    redirect_uris: d.redirect_uris as string[],
    client_name: name,
    ...(client_uri ? { client_uri } : {}),
    ...(logo_uri ? { logo_uri } : {}),
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  };
}

type Lookup = (
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) => void;

/** Resolve, refuse if ANY answer is non-public, and hand back only checked addresses to connect to */
export const guardedLookup: Lookup = (hostname, options, callback) => {
  runtime.lookup(hostname, { all: true }, (error, addresses) => {
    const list = addresses as LookupAddress[] | undefined;
    if (error || !list?.length) return callback(error ?? new Error('No address'), []);
    if (!list.every((a) => isPublicAddress(a.address))) return callback(new Error('Not a public address'), []);
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

/** GET the document: no redirects, 5 s overall, at most 32 KB, JSON only. Rejects on anything else. */
function fetchDocument(url: URL): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const local = localOk(url);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && !local && !isPublicAddress(host)) return reject(new Error('Not a public address'));
    if (host === 'metadata.google.internal' || host.endsWith('.internal'))
      return reject(new Error('Not a public host'));
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'ScotDance-OAuth' },
        signal: AbortSignal.timeout(runtime.fetchTimeoutMs),
        ...(local ? {} : { lookup: guardedLookup as never }),
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.destroy();
          return reject(new Error(`Status ${res.statusCode}`)); // redirects land here too
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            return reject(new Error('Too big'));
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new Error('Not JSON'));
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const cache = new Map<string, { client: OAuthClientInformationFull | undefined; until: number }>();

export const forgetClients = () => cache.clear();

/** The client a `client_id` names, or undefined if it isn't a fetchable, valid client document */
export async function getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
  const now = runtime.now();
  const hit = cache.get(clientId);
  if (hit && hit.until > now) return hit.client;
  let client: OAuthClientInformationFull | undefined;
  const url = clientIdUrl(clientId);
  if (url) {
    try {
      client = clientFromDocument(clientId, await fetchDocument(url)) ?? undefined;
    } catch {
      client = undefined;
    }
  }
  cache.delete(clientId);
  cache.set(clientId, { client, until: now + (client ? GOOD_MS : BAD_MS) });
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
  return client;
}

export const summary = (client: OAuthClientInformationFull): ClientSummary => ({
  id: client.client_id,
  name: client.client_name ?? client.client_id,
  ...(client.client_uri ? { uri: client.client_uri } : {}),
  ...(client.logo_uri ? { logo: client.logo_uri } : {}),
});
