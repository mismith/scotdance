import Typesense from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isEmulator } from './env';
import { getConfig } from './config';

type Client = InstanceType<typeof Typesense.Client>;

function connect(apiKey: string): Client {
  return new Typesense.Client({
    nodes: [{
      host: isEmulator() ? 'localhost' : getConfig().typesense?.host,
      // TYPESENSE_PORT: a second emulator stack (web/store) runs its own.
      port: isEmulator() ? Number(process.env.TYPESENSE_PORT) || 8108 : 443,
      protocol: isEmulator() ? 'http' : 'https',
    }],
    apiKey,
    // Triggers await indexing before keeping aggregates; a host that hangs
    // mustn't use up their 60 s, so give up on it quickly.
    connectionTimeoutSeconds: 10,
  });
}

let admin: Client;
let search: Client;

/** The admin key: only for indexing (the triggers and the admin reindexes). */
export function getTypesense() {
  if (!admin) admin = connect(isEmulator() ? 'xyz' : getConfig().typesense?.api_key);
  return admin;
}

/**
 * A key that can only search the competitions, dancers, judges and pipers
 * collections (docs/typesense-upgrade-runbook.md), for the search callables:
 * they take what anyone sends, so a slip there can't change the index.
 */
export function getTypesenseSearch() {
  if (!search) {
    const key = isEmulator() ? 'xyz' : getConfig().typesense?.search_api_key;
    // Never fall back to the admin key.
    if (!key) throw new Error('RUNTIME_CONFIG has no typesense.search_api_key');
    search = connect(key);
  }
  return search;
}

/**
 * A reindex: the collection made again with `documents`, already read, so
 * search is only empty while they go in. A thousand per request: all 117,000
 * dancers at once is about 30 MB, which risks the 10 s timeout on the small
 * Render plan. It returns the count, not the documents (they'd be too big a
 * response).
 */
export async function rebuild(schema: CollectionCreateSchema, documents: object[]) {
  await getTypesense().collections(schema.name).delete().catch(() => {});
  await getTypesense().collections().create(schema);
  for (let i = 0; i < documents.length; i += 1000) {
    await getTypesense().collections(schema.name).documents()
      .import(documents.slice(i, i + 1000), { action: 'upsert' });
  }
  return { indexed: documents.length };
}

/**
 * Search indexing from a trigger is best-effort: if Typesense is down (or a
 * collection hasn't been made yet), the aggregates and back-pointers the same
 * trigger keeps must still be updated.
 */
export async function indexBestEffort(what: string, work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
     
    console.error(`Typesense: ${what} failed`, error);
  }
}

/** Whether two versions of a record are the same apart from `fields` (e.g. back-pointers). */
export function sameExcept(before: unknown, after: unknown, fields: string[]): boolean {
  const strip = (v: unknown) => {
    if (!v || typeof v !== 'object') return v;
    const rest = { ...(v as Record<string, unknown>) };
    fields.forEach((f) => { delete rest[f]; });
    return rest;
  };
  return JSON.stringify(strip(before)) === JSON.stringify(strip(after));
}
