# ADR-0015: Organisers' other tools hand their work to ScotDance.app

Status: Accepted
Date: 2026-10-29 (built on `tools-connect`)

## Context

Organisers who skip ScotDance.app mostly do so because it's one more place
to type what they already have. Small standalone tools on `*.scotdance.app`
(Splits first: age-group splits and competitor numbers from an entry export)
can make the work, but each then has to get it into ScotDance.app without a
download, an import, and a second sign-in.

A first version had each tool sign in to Firebase itself and draw its own
sign-in and competition picker. Every tool then had to copy ScotDance.app's
look and keep up with it, add its domain to Firebase Auth, and ship the
Firebase SDK, and organisers signed in again on every tool's site.

## Decisions

### 1. ScotDance.app draws all of it, in an iframe over the tool

A tool loads `https://scotdance.app/embed.js` and calls
`ScotDance.send({ source, name, text })`. That opens `connect.html` in a
full-window, see-through iframe: the app's own sheet (Dialog, LoginForm,
date tiles), signing in if needed and asking which competition. The tool
draws only its own Send button. Like Plaid Link or Stripe's embedded
checkout, and no OAuth: there's no third party to grant anything to.

### 2. One sign-in, because the tools are the same site

`splits.scotdance.app` and `scotdance.app` are the same *site*, so browsers
give the iframe ScotDance.app's own, unpartitioned storage. Already signed in
to ScotDance.app: straight to the competitions. Signing in in the sheet signs
in to ScotDance.app too, so the Import dancers tab it opens is signed in.
Sign-in happens on ScotDance.app's own origin, so tools need no Firebase
authorised domain. (Sites elsewhere, like Jotform, would get partitioned
storage: real OAuth, if ever, is for them.)

### 3. Tools never write competition data

The sheet drops the list in the organiser's inbox (`users:inbox/{uid}`,
owner-only rules) and opens that competition's Import dancers on it
(`?inbox=`), where the usual preview checks it before anything is saved.
One importer, nothing changed unseen.

### 4. postMessage with both ends checked

`connect → tool: hello`, `tool → connect: send { item }`, then
`ready { scheme }`, `sent { … }`, `closed` (src/connect/protocol.ts,
public/embed.js). The page takes work only from the window that framed it,
from `https://scotdance.app` or `https://*.scotdance.app` (and localhost in
dev builds), and answers only that origin. The tool takes messages only
from the iframe it made, from ScotDance.app's origin. Hosting sends
`frame-ancestors https://scotdance.app https://*.scotdance.app` for
`connect.html` alone, so no other site can frame it to trick a tap.

### 5. Quick to open

`connect.html` is its own entry (Vite multi-page): Firebase, the auth store
and a handful of components, not the whole app. The embed shows a dimmed
backdrop at once, a spinner only after 400 ms, and crossfades to the app's
own backdrop when the sheet is ready; after 20 s it offers Try again. Glass
is solid there (`data-lite`): an iframe can't blur the page under it.

### 6. Sign in with ScotDance.app, for tools on other projects

Challenge keeps its own Firebase project, and has to save and edit entries
as you there, so a frame that does the work (decision 3) isn't enough: it
needs to know who you are. `ScotDance.signIn({ audience: 'challenge' })`
opens the same sheet: sign in, or "Continue as …" for whoever already is
(a tap, so no tool learns who you are unasked). The page then calls
`toolPass`, which returns a pass: a JWT (HS256, `TOOL_PASS_SECRET`) with
`aud` the tool, `sub` your uid, your email and name, good for 120 s. The
page hands it only to that tool's own site (`TOOLS` in protocol.ts:
Challenge's pass goes to challenge.scotdance.app alone). The tool's
function checks it with its copy of the secret and signs you in there with
a custom token of its own. Not this project's ID token: a tool with a bug
can't act as you on ScotDance.app.

### 7. The button looks the same on every tool

The one thing a tool draws, its "Send to ScotDance.app" or "Sign in with
ScotDance.app" button, is always ScotDance.app blue, whatever the tool's own
theme: `#1a6fd0` fill, white bold label, normal letter-spacing, and Scott
(the mark in `web/public/img/favicon.svg`) at 16px before the label. Splits'
Send button is the reference (`ExportSettingsDialog.vue` and
`ScotDanceMark.vue` in scotdance-splits); Challenge follows it.

## Consequences

- A brand or sign-in change ships once, with the app; every tool has it.
- `embed.js` is a public contract: keep `ScotDance.send` and the messages
  backward compatible, or version them.
- The embed lives where organisers sign in: `scotdance.app` once v4 is
  there (until then `next.scotdance.app`, and tools point at that).
- Safari's own password AutoFill inside the iframe is untested on devices.
- `TOOL_PASS_SECRET` lives in both projects (`firebase functions:secrets:set`);
  changing it means setting both. Adding a tool: an `AUDIENCES` entry
  (functions) and a `TOOLS` entry (protocol.ts) with its site.
