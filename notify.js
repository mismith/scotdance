#!/usr/bin/env node

import notifier from 'node-notifier';

const [message] = process.argv.splice(process.argv.indexOf(import.meta.filename) + 1, 1);
notifier.notify({
  title: 'ScotDance.app',
  message,
  sound: 'Glass',
  icon: './res/icon.png',
});

process.exit(0);
