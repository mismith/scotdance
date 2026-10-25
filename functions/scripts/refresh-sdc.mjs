// Reads ScotDance Canada's event list into /knownCompetitions from this
// computer. Their host answers Google's servers with a bot check, so the
// monthly job can't read it; a home connection can, like a browser. Run it
// in September and January, when the list fills up for the season:
//
//   npm run known:sdc            (from the repo root; --dry-run to only look)
//
// It runs the same refreshSource the function does, against the live
// database through the Firebase CLI (so it needs `firebase login`).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { refreshSource } = require('../dist/knownCompetitions.js');

const ROOT = new URL('../..', import.meta.url).pathname;
const DRY = process.argv.includes('--dry-run');
const firebase = (...args) => execFileSync('npx', ['firebase', ...args, '--instance', 'scotdance'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });

/** Just enough of a database reference for refreshSource, read and written through the CLI. */
function ref(path, query = []) {
  return {
    child: (p) => ref(`${path}/${p}`),
    orderByKey: () => ref(path, [...query, '--order-by-key']),
    startAt: (v) => ref(path, [...query, '--start-at', v]),
    endAt: (v) => ref(path, [...query, '--end-at', v]),
    async get() {
      const out = firebase('database:get', path, ...query).trim();
      const value = out ? JSON.parse(out) : null;
      return { val: () => value };
    },
    async update(values) {
      if (DRY) {
        const keys = Object.keys(values);
        console.log(`Would update ${keys.length} paths under ${path}, e.g.`, keys.filter((k) => !k.includes(':runs')).slice(0, 3));
        console.log('Run:', values['knownCompetitions:runs/sdc'] ?? values);
        return;
      }
      const file = join(mkdtempSync(join(tmpdir(), 'known-sdc-')), 'update.json');
      writeFileSync(file, JSON.stringify(values));
      firebase('database:update', path, file, '--force');
    },
  };
}

const result = await refreshSource(ref('/production'), 'sdc');
if (result.error) {
  console.error(`ScotDance Canada: ${result.error}`);
  process.exit(1);
}
console.log(`ScotDance Canada: ${DRY ? 'would store' : 'stored'} ${result.count} competitions`);
