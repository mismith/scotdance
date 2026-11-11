import * as v1 from 'firebase-functions/v1';
import {
  onValueCreated, onValueDeleted, onValueUpdated, onValueWritten, type ReferenceOptions,
} from 'firebase-functions/v2/database';
import {
  HttpsError, onCall, onRequest, type CallableOptions, type HttpsOptions, type Request,
} from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import type { Response } from 'express';
import { isAssistant } from './assistant';
import { isEmulator } from './env';

// 2nd gen functions, registered in the 1st gen shape the handlers (and
// @mismith/firebase-tools' FirebaseInvites) are written against:
// `database(options).ref(path).onCreate((snapshot, ctx) => …)` and
// `https(options).onCall((data, ctx) => …)`. Database events carry their 1st
// gen context (`params`, and `auth.uid` for a signed-in writer) as
// `event.context`, so handlers see exactly what they did on 1st gen.

// Run as the account 1st gen used (2nd gen defaults to the Compute Engine
// one), so database and secret access stay as they were. Each instance serves
// up to 80 requests at once; capping them caps what a flood (or a loop) costs.
setGlobalOptions({ serviceAccount: 'firebase-scotdance@appspot.gserviceaccount.com', maxInstances: 10 });

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

export interface CallableAccess {
  /**
   * Let an assistant's token call this. Off unless a callable says so: an assistant reaches what it may through the
   * tools built for it (which call a callable like this only for what they were made to do), never by calling it
   * directly, and never with a system admin's powers.
   */
  assistants?: boolean;
}

/**
 * Callables. A token with `via: 'mcp'` is turned away before the handler runs, unless the callable opts in with
 * `{ assistants: true }`. So a new callable is closed to assistants until someone decides otherwise (and the handler
 * must then ignore system-admin rights for such a token: see `isAssistant`).
 */
export function https(options: CallableOptions = {}, access: CallableAccess = {}) {
  return {
    onCall: (handler: Handler) => onCall(options, (request) => {
      if (!access.assistants && isAssistant(request.auth)) {
        throw new HttpsError('permission-denied', 'Assistants can’t do this.');
      }
      return handler(request.data, {
        auth: request.auth ?? null,
        rawRequest: request.rawRequest,
      });
    }),
  };
}

// Plain HTTP requests (the `mcp` function's Express app, which serves the
// assistants' OAuth and MCP endpoints), through the same global options.
export function request(options: HttpsOptions = {}) {
  return {
    onRequest: (handler: (req: Request, res: Response) => void | Promise<void>) => onRequest(options, handler),
  };
}
