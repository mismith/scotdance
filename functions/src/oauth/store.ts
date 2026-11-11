import type { Reference } from 'firebase-admin/database';

/** A stored record: plain JSON fields. Times are milliseconds since 1970 (the Realtime Database has no dates). */
export type Doc = Record<string, unknown>;

/** What `Store.update`'s function returns to leave a record as it is */
export const KEEP = Symbol('keep');

/**
 * Everything OAuth needs from the database. Paths are inside the data namespace and look like
 * `oauth:codes/<hash>` (ADR 0018). Server-only: the rules give clients no access to these.
 */
export interface Store {
  get(path: string): Promise<Doc | undefined>;
  set(path: string, doc: Doc): Promise<void>;
  delete(path: string): Promise<void>;
  /**
   * Change one record atomically (a Realtime Database transaction). `fn` is given what is there (undefined if
   * nothing) and returns the record to leave, `null` to delete it, or KEEP to change nothing. It may run more
   * than once, so keep it free of side effects. Returns what was there and what is there now.
   */
  update(
    path: string,
    fn: (current: Doc | undefined) => Doc | null | typeof KEEP,
  ): Promise<{ before: Doc | undefined; after: Doc | undefined }>;
  /** The paths of every record in a collection whose `connection` field is this */
  byConnection(collection: string, connection: string): Promise<string[]>;
  /** The paths of every record in a collection whose `expiresAt` is at or before this time */
  expiredIn(collection: string, now: number): Promise<string[]>;
  /** Delete many records (not atomically) */
  deleteAll(paths: string[]): Promise<void>;
}

/** The database refuses `undefined`, so optional fields are simply left out */
export const clean = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));

export function rtdbStore(root: Reference): Store {
  const at = (path: string) => root.child(path);
  const keysIn = async (collection: string, query: (ref: Reference) => ReturnType<Reference['orderByChild']>) => {
    const snap = await query(at(collection)).get();
    return Object.keys((snap.val() as Doc | null) ?? {}).map((key) => `${collection}/${key}`);
  };
  return {
    async get(path) {
      const snap = await at(path).get();
      return snap.exists() ? (snap.val() as Doc) : undefined;
    },
    async set(path, doc) {
      await at(path).set(clean(doc));
    },
    async delete(path) {
      await at(path).remove();
    },
    async update(path, fn) {
      let before: Doc | undefined;
      const result = await at(path).transaction((current: Doc | null) => {
        before = current ?? undefined;
        const next = fn(before);
        if (next === KEEP) {
          // The first try sees null even when something is there (nothing is cached). Giving up now would never
          // see the real record, so write null: the server checks it against what is there and, if they differ,
          // runs this again with the real thing.
          return current == null ? null : undefined;
        }
        return next === null ? null : clean(next);
      });
      const after = result.snapshot.exists() ? (result.snapshot.val() as Doc) : undefined;
      return { before, after };
    },
    byConnection: (collection, connection) => keysIn(collection, (ref) => ref.orderByChild('connection').equalTo(connection)),
    expiredIn: (collection, now) => keysIn(collection, (ref) => ref.orderByChild('expiresAt').endAt(now)),
    async deleteAll(paths) {
      for (let i = 0; i < paths.length; i += 400) {
        const updates = Object.fromEntries(paths.slice(i, i + 400).map((p) => [p, null]));
        await root.update(updates);
      }
    },
  };
}
