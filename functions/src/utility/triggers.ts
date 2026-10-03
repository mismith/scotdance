import * as v1 from 'firebase-functions/v1';
import {
  onValueCreated, onValueDeleted, onValueUpdated, onValueWritten, type ReferenceOptions,
} from 'firebase-functions/v2/database';
import { onCall, type CallableOptions } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { isEmulator } from './env';

// 2nd gen functions, registered in the 1st gen shape the handlers (and
// @mismith/firebase-tools' FirebaseInvites) are written against:
// `database(options).ref(path).onCreate((snapshot, ctx) => …)` and
// `https(options).onCall((data, ctx) => …)`. Database events carry their 1st
// gen context (`params`, and `auth.uid` for a signed-in writer) as
// `event.context`, so handlers see exactly what they did on 1st gen.

// Run as the account 1st gen used (2nd gen defaults to the Compute Engine
// one), so database and secret access stay as they were.
setGlobalOptions({ serviceAccount: 'firebase-scotdance@appspot.gserviceaccount.com' });

type DatabaseOptions = Omit<ReferenceOptions, 'ref' | 'instance'>;
type Handler = (dataOrChange: any, ctx: any) => unknown;

// 1st gen database triggers only watched the default instance; 2nd gen watches
// every instance unless told otherwise.
const instance = 'scotdance';

export function database(options: DatabaseOptions = {}) {
  // The database emulator's 2nd gen events don't say who wrote (production's
  // do, as authtype/authid), and invites and submissions need that. So locally
  // the database triggers run as 1st gen, whose emulated events do.
  if (isEmulator()) return v1.runWith(options as v1.RuntimeOptions).database;
  return {
    ref(path: string) {
      const opts = { ...options, ref: path, instance };
      return {
        onCreate: (handler: Handler) => onValueCreated(opts, (e) => handler(e.snapshot, e.context)),
        onUpdate: (handler: Handler) => onValueUpdated(opts, (e) => handler(e.change, e.context)),
        onDelete: (handler: Handler) => onValueDeleted(opts, (e) => handler(e.snapshot, e.context)),
        onWrite: (handler: Handler) => onValueWritten(opts, (e) => handler(e.change, e.context)),
      };
    },
  };
}

export function https(options: CallableOptions = {}) {
  return {
    onCall: (handler: Handler) => onCall(options, (request) => handler(request.data, {
      auth: request.auth ?? null,
      rawRequest: request.rawRequest,
    })),
  };
}
