import { firebase } from '@/helpers/firebase';

export const DEMO_DURATION = /* 60 * */ 10 * 1000; // @TEMP

export async function startDemo(demosRef) {
  // request a new demo
  const demoSnap = await demosRef.push({
    requested: firebase.database.ServerValue.TIMESTAMP,
  });

  // wait for it to be created
  const started = demoSnap.ref.child('started');
  await new Promise((resolve, reject) => {
    let off;
    const timeout = setTimeout(() => {
      off?.();
      reject(new Error(`Starting demo (${demoSnap.key}) timed out`));
    }, 10000); // 10 seconds
    const handler = (startedSnap) => {
      if (startedSnap.val()) {
        clearTimeout(timeout);
        off?.();
        resolve();
      }
    };
    off = () => started.off('value', handler);
    started.on('value', handler);
  });

  return demoSnap;
}

export async function stopDemo(demoRef) {
  return demoRef.child('stopped').set(firebase.database.ServerValue.TIMESTAMP);
}
