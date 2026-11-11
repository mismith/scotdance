import { COLLECTIONS, connectionPath } from './common';
import { getStore } from './runtime';

/**
 * End a connection: its record first (so a refresh in flight finds it gone), then every code, access token and
 * refresh token made for it. Only that account's connection of that id is touched, so a mismatched pair can't end
 * someone else's. False if there was no such connection (ending one twice is not an error).
 */
export async function endConnection(uid: string, connection: string): Promise<boolean> {
  const store = getStore();
  if (!(await store.get(connectionPath(uid, connection)))) return false;
  await store.delete(connectionPath(uid, connection));
  const found = await Promise.all(
    COLLECTIONS.filter((collection) => collection !== 'oauth:requests').map((collection) => store.byConnection(collection, connection)),
  );
  // Another account's token can't carry this connection id (they are random and 128 bits), but check anyway
  const own = await Promise.all(found.flat().map(async (path) => ((await store.get(path))?.uid === uid ? path : null)));
  await store.deleteAll(own.filter((path): path is string => path !== null));
  return true;
}
