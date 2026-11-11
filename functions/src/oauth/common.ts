import { createHash } from 'node:crypto';
import type { Doc } from './store';
import { runtime } from './runtime';

/**
 * What a connection may do. Every connection can read and write what its owner can (ADR 0018). The string is stored
 * on tokens anyway, so a separate `admin` scope for system admin tools can be added one day without a migration.
 */
export type Scope = 'manage';
export const SCOPE: Scope = 'manage';

export const REQUEST_TTL = 10 * 60_000;
export const CODE_TTL = 60_000;
export const ACCESS_TTL = 60 * 60_000;
export const REFRESH_TTL = 60 * 24 * 60 * 60_000;
/** A refresh token presented again this soon after its first use is a retry (a dropped response), not a copy */
export const REFRESH_GRACE = 30_000;

/** What we store in place of a secret: nobody reading the database can use it */
export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export const later = (ms: number) => runtime.now() + ms;

/** True unless the record has an `expiresAt` still ahead of us */
export const expired = (doc: Doc) => typeof doc.expiresAt !== 'number' || doc.expiresAt <= runtime.now();

/** The collections OAuth keeps in the database, each a server-only path inside the data namespace */
export const COLLECTIONS = ['oauth:requests', 'oauth:codes', 'oauth:tokens', 'oauth:refresh'] as const;

/** An account's connection to one assistant: who, which client, when made and last used */
export const connectionPath = (uid: string, connection: string) => `users:connections/${uid}/${connection}`;

/** A document field known to be a string */
export const str = (doc: Doc, key: string) => (typeof doc[key] === 'string' ? (doc[key] as string) : '');
