import { lookup as dnsLookup } from 'node:dns';
import { randomBytes } from 'node:crypto';
import type { Store } from './store';

/** How the real world is reached; tests swap these for fakes */
export const runtime = {
  /** Set once at start-up (index.ts) to the Realtime Database; tests use memoryStore() */
  store: undefined as Store | undefined,
  now: () => Date.now(),
  lookup: dnsLookup as typeof dnsLookup,
  /** How long a client document may take; tests shorten it */
  fetchTimeoutMs: 5000,
  /** HTTP for Identity Toolkit and the database's REST API (mcp/session.ts); tests swap it */
  fetch: ((...args: Parameters<typeof fetch>) => fetch(...args)) as typeof fetch,
};

export const getStore = (): Store => {
  if (!runtime.store) throw new Error('The OAuth store is not set up');
  return runtime.store;
};

/** 32 random bytes, base64url: 43 characters, for tokens, codes and request ids */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
