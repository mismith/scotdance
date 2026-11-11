import { emulated } from '../mcp/config';
import type { Access } from '../mcp/types';
import { SCOPE, expired, sha256, str } from './common';
import { getStore } from './runtime';

/**
 * The access an access token stands for, or null if it's unknown, expired or ended.
 *
 * `dev:<uid>` is accepted only when `emulated()`, never in production, so the tools can be tried without OAuth.
 */
export async function verifyAccessToken(token: string): Promise<Access | null> {
  if (typeof token !== 'string' || !token) return null;
  if (emulated()) {
    const [kind, uid] = token.split(':');
    if (kind === 'dev' && uid) return { connection: 'dev', uid, scope: SCOPE, client: { id: 'dev', name: 'Dev' } };
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null; // not one of ours: no need to ask the database
  // Asked every time, never remembered: ending a connection has to stop it at once, and the `mcp` function and the
  // one that ends a connection don't share memory. One small read per call.
  let doc;
  try {
    doc = await getStore().get(`oauth:tokens/${sha256(token)}`);
  } catch (error) {
    // Can't tell, so don't let anyone in
    console.error('oauth token lookup failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
  if (!doc || expired(doc)) return null;
  if (doc.scope !== SCOPE || !str(doc, 'connection') || !str(doc, 'uid')) return null;
  return {
    connection: str(doc, 'connection'),
    uid: str(doc, 'uid'),
    scope: SCOPE,
    client: { id: str(doc, 'clientId'), name: str(doc, 'clientName') },
  };
}
