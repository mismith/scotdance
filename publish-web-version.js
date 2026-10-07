#!/usr/bin/env node

// Runs after each production web deploy (firebase.json postdeploy): sets
// versions/web to the version just deployed. Open tabs on an older one offer
// to reload, and the web build stops counting as early (useUpdate). The apps'
// versions stay manual (Tools), set once each store's release is live.

import { execFileSync } from 'child_process';
import fs from 'fs';

const { version } = JSON.parse(fs.readFileSync(new URL('./web/package.json', import.meta.url), 'utf8'));

execFileSync('npx', [
  'firebase', 'database:set', '/production/versions/web',
  '--data', JSON.stringify(version),
  '--instance', 'scotdance',
  '--project', process.env.GCLOUD_PROJECT || 'firebase-scotdance',
  '--force',
], { stdio: 'inherit' });

console.info(`versions/web -> ${version}`); // eslint-disable-line no-console
