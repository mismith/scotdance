#!/usr/bin/env node

const notifier = require('node-notifier');

const [message] = process.argv.splice(process.argv.indexOf(__filename) + 1, 1);
notifier.notify({
  title: 'ScotDance.app',
  message,
  sound: 'Glass',
  icon: './res/icon.png',
});
process.exit(0);
