// Preloaded into the Firebase CLI (NODE_OPTIONS=--require) where the emulators
// run one functions worker (--inspect-functions). That worker runs every
// function: before each event the CLI tells it which one over IPC, then sends
// the event over HTTP on a kept-alive socket. On a busy Linux runner the worker
// now and then reads the event first and runs it as the previous function: a
// 1st gen database trigger handed another's event throws (reading 'match'),
// which kills the worker and the events queued behind it, or quietly handles an
// event that isn't its own. With a new connection per event, the IPC message
// always lands first. Still needed as of firebase-tools 15.33.0: drop it once
// https://github.com/firebase/firebase-tools/issues/11263 is fixed.
const http = require('node:http')

http.globalAgent = new http.Agent({ keepAlive: false })
