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

## Consequences

- A brand or sign-in change ships once, with the app; every tool has it.
- `embed.js` is a public contract: keep `ScotDance.send` and the messages
  backward compatible, or version them.
- The embed lives where organisers sign in: `scotdance.app` once v4 is
  there (until then `next.scotdance.app`, and tools point at that).
- Safari's own password AutoFill inside the iframe is untested on devices.
