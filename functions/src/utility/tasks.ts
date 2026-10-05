import type { App } from 'firebase-admin/app';
import { getFunctions } from 'firebase-admin/functions';
import { GoogleAuth } from 'google-auth-library';
import { isEmulator } from './env';

// Cloud Tasks queues: work for later, run by an `onTaskDispatched` function
// (Firebase's way to delay something without holding a function open). On
// 2nd gen, a task must be addressed to the function's own URL, which only the
// Cloud Functions API knows: looked up once per instance. The emulator routes
// tasks by name.

const LOCATION = 'us-central1';
/** The account the functions run as (utility/triggers.ts), so it may enqueue and invoke. */
export const TASKS_INVOKER = 'firebase-scotdance@appspot.gserviceaccount.com';

let auth: GoogleAuth | null = null;
const urls = new Map<string, Promise<string>>();

function functionUrl(name: string) {
  if (!urls.has(name)) {
    urls.set(name, (async () => {
      auth ??= new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
      const projectId = await auth.getProjectId();
      const client = await auth.getClient();
      const res = await client.request<{ serviceConfig?: { uri?: string } }>({
        url: `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${LOCATION}/functions/${name}`,
      });
      const uri = res.data?.serviceConfig?.uri;
      if (!uri) throw new Error(`No URL for function ${name}`);
      return uri;
    })().catch((e) => {
      urls.delete(name);
      throw e;
    }));
  }
  return urls.get(name) as Promise<string>;
}

/** Queue `data` for the task function `name`, to run `delaySeconds` from now. */
export async function enqueue(app: App, name: string, data: Record<string, unknown>, delaySeconds: number) {
  const queue = getFunctions(app).taskQueue(`locations/${LOCATION}/functions/${name}`);
  await queue.enqueue(data, {
    scheduleDelaySeconds: delaySeconds,
    ...(!isEmulator() && { uri: await functionUrl(name) }),
  });
}
