import Typesense from 'typesense';

import { isEmulator } from './env';
import { getConfig } from './config';

let client: InstanceType<typeof Typesense.Client>;

export function getTypesense() {
  if (!client) {
    client = new Typesense.Client({
      nodes: [{
        host: isEmulator() ? 'localhost' : getConfig().typesense?.host,
        port: isEmulator() ? 8108 : 443,
        protocol: isEmulator() ? 'http' : 'https',
      }],
      apiKey: isEmulator() ? 'xyz' : getConfig().typesense?.api_key,
      // Triggers await indexing before keeping aggregates; a host that hangs
      // mustn't use up their 60 s, so give up on it quickly.
      connectionTimeoutSeconds: 10,
    });
  }
  return client;
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
    // eslint-disable-next-line no-console
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
