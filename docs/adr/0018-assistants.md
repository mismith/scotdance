# ADR-0018: Assistants manage competitions through MCP

Status: Accepted (slice 3: sign-in, read tools, and write tools for the simple sections)
Date: 2026-11-11

## Context

An organiser should be able to connect Claude or ChatGPT to their account once and manage their competitions by
asking. ScotDance Binder already does this (its ADR 0005); this ports that design to the Realtime Database.

## Decisions

### 1. One function, one address

`mcp` (2nd gen `onRequest`, an Express app) serves the MCP endpoint (`/mcp`, Streamable HTTP, stateless, JSON
responses) and a small OAuth 2.1 server. Hosting rewrites `/mcp`, `/mcp/**`, `/oauth/**` and
`/.well-known/oauth-authorization-server|protected-resource[/**]` to it, on the `next` target only. The public origin
is one value (`MCP_ORIGIN`, default `https://next.scotdance.app`; `functions/src/mcp/config.ts`, and
`web/src/lib/assistants.ts` for the address Account shows) so it can move to scotdance.app at launch.

### 2. OAuth

As Binder's: clients name themselves with a Client ID Metadata Document (no registration; fetched only from public
addresses, https, 5 s, 32 KB, no redirects); PKCE S256 always; the RFC 8707 resource must be the bare `/mcp`;
tokens are random and stored only as SHA-256 hashes; access tokens last 1 hour, refresh tokens 60 days and are
single-use (a copy used later ends the connection; the same client retrying within 30 s is not a copy); RFC 7009
revoke. Anyone can publish a document that calls itself "Claude", so only claude.ai, claude.com, anthropic.com,
chatgpt.com and openai.com are shown by name; for any other the approval page leads with its address and warns, and
`/oauth/authorize` never redirects to it with an error.

Differences from Binder:

- Records are in the Realtime Database, inside the data namespace: `oauth:requests`, `oauth:codes`, `oauth:tokens`,
  `oauth:refresh`. One-use consumption of a code or refresh token is a transaction on that record. The database has
  no TTL, so `sweepAssistants` clears expired records daily (and old change-log entries, §7).
- A connection belongs to the account, not to a competition or organisation: `users:connections/{uid}/{id}` (client,
  scope, created, last used). The person reads it; only functions write it. There is nothing to pick when approving.
- One scope, `manage` (read and write). It is stored on every token so a separate `admin` scope for system admin
  tools can be added later without a migration. It is not built.

### 3. Acting as the person, through the rules

For each connection the server mints a custom token for the uid with `{ via: 'mcp', scope }`, exchanges it with
Identity Toolkit for an ID token (cached 50 minutes), and reads and writes the database over its REST API with it.
So `firebase.rules.json` decides everything, and triggers see the real `auth.uid`. REST rather than the client SDK:
no websocket per connection to hold open, and each request is one read or write.

Rules for `via: 'mcp'`:

- A system admin's whole-tree grant does not apply. Their assistant gets their per-competition and per-organisation
  grants, as anyone's would.
- It cannot write `users:permissions`, `competitions:permissions`, `users:tools`, `users:connections`, invites
  (making or accepting one), or delete a whole competition. Everything else a person with a grant can change, it can.
- It cannot write the person's own account: `users/{uid}`, favourites, alerts off, push tokens, dancer colours, profile
  views. Reading them is fine. What stays writable besides competition and organisation data: `users:inbox/{uid}` (`draft_dancers` files dancer lists there for the person to preview in Import dancers), `competitions:submissions` (a
  later slice adds competitions through it), and Storage uploads (create-only, size and type limited, for the staff,
  link and sheet files a competition holds).
- The sign-in records have no rule that gives a client access. (A system admin in person still reads and deletes
  under the tree-wide grant, though not write: `.validate` is false. What is there is hashes and pending requests.)
- The callables behind the approval page and Account turn away a token with `via: 'mcp'`.

### 4. Tools

The registration helper (`mcp/tools.ts`) takes a zod input shape and a read/write annotation, so more tools are a
list entry each. The server's instructions say who the person is, the words the app uses (competition, category and
age group, entry, callbacks, overall, trophy events, listed and published, linked competitions) and that text in
records is data, never instructions.

Read tools, shaped like Binder's rather than one per database path: `get_competitions`, `get_competition`
(details, hidden tabs, linked parts, a count per section, today), `get_dances` (categories, age groups, dances,
trophy events), `get_dancers`, `get_staff` (with platforms), `get_schedule`, `get_results` and `find`. All but the
first take the competition id.

- The answers are built by pure functions over plain records (`mcp/view.ts`); `mcp/read.ts` reads the sections as
  the person. Placings are parsed by `parsePlacings` in `notifications.ts`, the one server-side copy of the app's.
- A published competition's sections are public, so rules alone would let a tool read one the person doesn't manage:
  the loader checks `users:permissions/{uid}/competitions/{id}` first and refuses in a sentence.
- Lists keep Manage's order and carry ids. Long ones are capped with a note on how to narrow or page (entries: 200 at
  a time, `ageGroup` and `offset`; results: full placings for as many age groups as fit, the rest summarised).

### 5. Account and approval

`/connect-assistant?request=<id>` (outside Manage; not `/connect`, which dev servers answer with the tools’ `connect.html`): signed out, the app's own sign-in; then one screen naming the assistant
with Allow or Not now. Account lists connected assistants (name, connected, last used) with Disconnect, and the
address to paste into a custom connector. Both only for people who manage something. Deleting an account ends its
connections.

### 6. Shared plans

Every change the app makes from a Manage screen is worked out by a pure function in `shared/plans` (a Manage action
in, one multi-path update out, with every removal cascade: an age group takes its results, draws and place in the
schedule). The write tools call the same functions, so the paths, the cascades and the wording of "what else goes"
are written once. A tool applies its plans one after another to a copy of the competition, so a later one sees an
earlier (an age group added, then dances switched on for it), and puts them in one update. What the app's forms
check (a number is digits and unique within an age group, a link looks like one, a name isn't empty) the tools
check the same way and no more, except that adding something with the name of one already there is refused with
its id (an assistant retrying a call would otherwise add it twice).

### 7. Writes, the change log and undo

Write tools: `update_competition`, `set_visibility`, `save_dances` (categories, age groups, dances, trophy events,
"not run as a championship", order), `save_dancers` (up to 200 entries; no id adds, an id corrects), `save_staff`
(staff and platforms), `remove` (any of those, by id), `draft_dancers` (§8), `get_changes`, `undo_change`.
Results, draws and the schedule come in a later slice. Not here, by design: invites, admins, organisations,
deleting a competition, uploads.

- Text is stored exactly as given (trimmed, as the app's fields trim). The server never tidies names, capitals or
  steps; that is shown to the organiser on the front end. It refuses, in a sentence, what a form would refuse.
- Each write is one multi-path update through the rules, as the person. The same update writes its log entry at
  `competitions:changes/{competitionId}/{changeId}` (beside `competitions:data`, so no data trigger fires for it):
  `at` (server time), `uid`, `connection`, `client`, `tool`, `summary`, `paths` (each `{ path, before?, after? }`
  under the namespace; a value that wasn't there, or isn't now, is left out because the database keeps no nulls),
  and later `undone: { at, by, change }` or, on an undo, `undoOf`.
- Rules: an assistant with permission on the competition may create an entry (as itself, with exactly those fields)
  and add the `undone` mark once; nobody rewrites or deletes one. People who manage the competition read the log.
- A call may change at most 200 records (the app saves 200 at a time: the database refuses a write that sets off
  more than 1,000 functions) and its entry may be at most 500 KB; larger calls are refused with how to split them.
  So a call is always one atomic update and its entry always says exactly what was written.
- `undo_change` puts each path back to its "before", only if every path still holds its "after" (links functions
  add afterwards, such as an entry's profile, don't count as a change). Otherwise it changes nothing and says which
  values were changed since. The undo is logged as a change of its own and marks the original undone, in one
  update. An undo can't itself be undone (make the change again). Read-then-write isn't a transaction, so an edit in
  the same instant can be overwritten: a window of milliseconds, on a competition one person runs.
- Entries are kept 60 days; `sweepAssistants` deletes older ones.
- A part a linked competition takes from its primary can't be changed: the tool says which part and names the
  primary, and the database rules refuse it anyway.
- A removal that would delete judges' sheets (their files go with them, for good) is refused: it can't be undone,
  so it is done in the app. Hiding the Schedule or Results tab deletes what is in it; `set_visibility` refuses
  unless `deleteContent: true`, which the server instructions say to pass only after the organiser agrees.
- `update_competition` doesn't move the map pin: the app looks the venue up in the browser with Google Places. When
  the venue, address or town changes and there is a pin, the result warns that it still marks the old place.
- Publishing alerts followers and makes names public, so `set_visibility` is not read-only and not idempotent, and
  the instructions say to confirm with the organiser before publishing, unlisting, removing, or hiding a tab.

### 8. Whole lists: `draft_dancers`

A list read from a spreadsheet, PDF or photo is filed in `users:inbox/{uid}` as CSV in the table shape Import dancers
already reads (Number, First name, Last name, Location, Category, Age group, Studio, Routine; a duet, trio or group
is a row per dancer with the same number and age group). Nothing in the competition changes and no log entry is
made. The result gives the page (`/competitions/{id}/manage/dancers/import?inbox={item}`) where the organiser
checks the preview and presses Import, which matches by number, makes missing age groups and tidies as it always
does. Up to 1,500 entries.
