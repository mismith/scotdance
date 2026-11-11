import { KEEP, clean, type Doc, type Store } from './store';

/** An in-memory `Store` with the same semantics as the Realtime Database one, for tests (updates take turns) */
export function memoryStore(): Store & { docs: Map<string, Doc> } {
  const docs = new Map<string, Doc>();
  let turn: Promise<unknown> = Promise.resolve();
  const copy = (doc: Doc | undefined) => (doc ? structuredClone(doc) : undefined);
  const inCollection = (collection: string, test: (doc: Doc) => boolean) => [...docs]
    .filter(([path, doc]) => path.startsWith(`${collection}/`) && test(doc))
    .map(([path]) => path);

  return {
    docs,
    async get(path) {
      // Like the database, a path above records reads as the records under it, by key
      const children = [...docs].filter(([key]) => key.startsWith(`${path}/`));
      if (!docs.has(path) && children.length) {
        return Object.fromEntries(children.map(([key, doc]) => [key.slice(path.length + 1), structuredClone(doc)]));
      }
      return copy(docs.get(path));
    },
    async set(path, doc) {
      docs.set(path, clean(doc));
    },
    async delete(path) {
      docs.delete(path);
    },
    update(path, fn) {
      const run = async () => {
        const before = copy(docs.get(path));
        const next = fn(copy(before));
        if (next === null) docs.delete(path);
        else if (next !== KEEP) docs.set(path, clean(next));
        return { before, after: copy(docs.get(path)) };
      };
      const next = turn.then(run, run);
      turn = next.catch(() => undefined);
      return next;
    },
    async byConnection(collection, connection) {
      return inCollection(collection, (doc) => doc.connection === connection);
    },
    async expiredIn(collection, now) {
      return inCollection(collection, (doc) => typeof doc.expiresAt === 'number' && doc.expiresAt <= now);
    },
    async deleteAll(paths) {
      for (const path of paths) docs.delete(path);
    },
  };
}
