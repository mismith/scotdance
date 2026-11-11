# ADR-0018: AI assistants manage competitions through MCP

Status: Accepted (slice 6: sign-in, read tools, write tools, results, draws and the schedule, organisations, adding a competition, the Account change list)
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
  views. Reading them is fine. What stays writable besides competition and organisation data: `users:inbox/{uid}` (`draft_dancers` files dancer lists there for the person to preview in Import dancers), `competitions:submissions` (`add_competition` files a competition through it, §11), and Storage uploads (create-only, size and type limited, for the staff,
  link and sheet files a competition holds).
- The sign-in records have no rule that gives a client access. (A system admin in person still reads and deletes
  under the tree-wide grant, though not write: `.validate` is false. What is there is hashes and pending requests.)
- The callables behind the approval page and Account turn away a token with `via: 'mcp'` (and so does every other callable: §10).

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

`/connect-ai?request=<id>` (outside Manage; not `/connect`, which dev servers answer with the tools’ `connect.html`): signed out, the app's own sign-in; then one screen naming the assistant
with Allow or Not now. Account's section is called **AI assistants** (people don't take "assistants" alone to mean AI; the same word is used on the approval page, the
sheets, confirmations and errors; files, data paths, functions and tool names keep their names). It lists connected AI assistants (name,
connected, last used) with Disconnect, and the address to paste into a custom connector. Tapping an assistant opens a sheet of what it changed
lately (§13). The section and the approval are only for people who manage a competition or organisation, or are system admins: the section shows
for them (or when a connection already exists); the page says so to anyone else, and `approveConnection` refuses them too (permission-denied,
checked against `users:permissions/{uid}`), so skipping the page does not get round it. Saying no is open to anyone. Deleting an account ends its
connections and clears its change index.

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
(staff and platforms), `remove` (any of those, by id), `draft_dancers` (§8), `save_results`, `save_draws`,
`save_schedule` (§9), `update_organisation`, `create_organisation` (§10), `add_competition` (§11), `get_changes`, `undo_change`.
Not here, by design: invites, admins, deleting a competition, uploads.

A dance is a twin only when its name and steps both match (“Highland Fling” at 4 and at 6 steps is normal in one
competition). Other twins refused: a category by name; an age group by name within its category; a trophy event by
name; staff by role and full name; a platform by name. The same check applies when an existing record is renamed (or
its dance's steps changed) into a twin of another; a change that does not touch the name is never refused for twins
already there. Two trophy events, or two staff with the same role and name, can be legitimate: `allowSameName: true`
on `save_dances` / `save_staff` (named in the refusal) lets them through, and the instructions say to pass it only when
the organiser says they really are two. The others have no override.

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
- Entries (and the per-person index, §13) are kept 30 days; `sweepAssistants` deletes older ones.
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

### 9. Results, draws and the schedule

All three go through the same `shared/plans` functions as the Results, Draws and Schedule screens (extended with
`planSetPoints`, `isEligible` and `replaceDay`, which the screens' behaviour does not depend on).

**`save_results`**: rows of `{ ageGroup | trophyEvent, row, numbers, reversedFrom, noResults, points, allowStandIns }`.
`row` is `callbacks`, `overall`, or a dance the age group dances (a trophy event has `callbacks`, only if danced, and
`overall`, its placings). `numbers` is the placing order by entry number, 1st first, a tie as an inner list
(`["101", ["105","99"], "150"]`); with `reversedFrom: 6` it is in the order announced, lowest place first. Callbacks are
a flat list. `get_results` gives each row's `numbers` in exactly this shape. Saving a row replaces it (an empty list
clears it; leaving `numbers` out changes only `reversedFrom` or `points`). Refused in a sentence: a number that is not an
entry in the age group (for a trophy event: the groups it is open to; an ambiguous number needs the entry id), a dancer
placed twice, a dance the age group does not dance, an overall for Primary, `reversedFrom` smaller than the list, ties in
callbacks, anyone not called back once callbacks are entered (as the app only offers those dancers), someone both placed
and given a point. A `?` is accepted only with `allowStandIns: true`. A warning says when callbacks are not entered yet.
Writes are applied callbacks first, so a dance can follow its callbacks in one call.

*Alerts.* A results write on a published competition is public at once. `notifyFollowersOnResult` (index.ts) queues a
task for each dance or overall (and trophy event) row with a follower of a dancer in it, which runs after 60 s and sends
only if the row still holds what was saved; only on competition day ±1 day, and callbacks and points never alert. So the
instructions tell the assistant to read the placings back and get a yes first (unless given the exact placings), and to
correct a wrong save at once: a corrected save inside the minute means the wrong alert is never sent. An alert already
sent is not recalled: a correction replaces it (one per person per dance, keyed on the person), and an
`undo_change` is such a correction (it restores the earlier placings; an undo that leaves the row empty queues nothing).

**`save_draws`**: rows of `{ ageGroup, dance | "all", order | action }`; `order` is entry numbers (replaces the draw, `[]`
clears), `action` is `shuffle`, `numberOrder`, `clear`, `addMissing`, `removeStrays`. Shuffling follows
`planShuffleAll`: reels are danced in number order, so a reel shuffled alone is put in number order with a warning.

**`save_schedule`**: whole days in the shape `get_schedule` returns (days › sessions › events › dances › platforms, each
with `ageGroups` and `judges`; a gap between age groups is `{ gap: true }`). A day sent is saved exactly as described:
what it leaves out goes (said in a warning; ids given are kept), days not sent are untouched, and a day without
`sessions` keeps its own. A day is found by id, else date, else name, else added. Only a dance row has platforms; an age
group only goes with a dance it dances and a danced trophy event only with its own dance (`isEligible`); judges must be
Judges; no duplicates in a cell. A schedule is one record to the change log, so only the 500 KB limit applies (split by
day). `get_schedule` renamed its `blocks` to `sessions` and a dance row's `name` to `dance` (`name` is for rows that are not dances).

Linked competitions share only staff, details and visibility (ADR 0007), none of which these three tools write.

### 10. Callables, organisations and linking

**Callables.** An assistant session holds a real Firebase ID token for its owner (marked `via: 'mcp'`), so anything that
accepts an ID token accepts it. Audit (2026-11-11):

- Every callable in `functions/src/index.ts` (the system admin utilities behind `ensureAdmin`, `searchDancers` and
  `searchAll`, which widen their results for an admin, `linkCompetitions`, `createOrganisation`, `toolPass`, `unlinkTool`,
  the three connection callables) used to run for such a token. Only the connection callables turned it away; for the
  rest, `ensureAdmin` and the others checked `users:permissions/{uid}/admin`, which a system admin's assistant had.
  So a system admin's assistant could run a backfill or reindex, and any assistant could mint a tool pass.
- Now `https()` in `utility/triggers.ts` (the wrapper every callable goes through) turns a `via: 'mcp'` token away before
  the handler runs, unless the callable opts in with `{ assistants: true }`. None does. `ensureAdmin` and
  `createOrganisation` also refuse to treat an assistant as a system admin, in case a callable is ever opted in.
  `backend-callables.spec.ts` calls every callable (found by reading `index.ts`) with a system admin's assistant token and expects
  `PERMISSION_DENIED`, and the same admin in person is let through; `functionsCallableGuard.test.ts` covers the wrapper,
  `ensureAdmin` and `toolPass`, and fails if a callable opts in.
- Other places a token is accepted: the one HTTP function (`mcp`) takes its own OAuth tokens, never an ID token. Storage
  rules take any signed-in user for create-only, size- and type-limited uploads, so an assistant token can upload a file (no tool does;
  nothing it uploads is linked from anywhere without a database write the rules govern). Firebase Auth's own account endpoints
  (change email or password, delete the account) accept any ID token for its account: the token lives only in the `mcp`
  function's memory (50 minutes) and is used only to read and write the database, but it is the reason the token must never
  be handed to a client.

**Organisations.** `get_organisations` lists the ones the person is an admin of, with their competitions (from a year ago;
competitions name their organisations, so it reads those from a date on). `update_organisation` does what the Manage page does:
name, short name, where it is based, website, description, links (never uploads or the logo), and `addCompetitions` /
`removeCompetitions` by id (the rules' `competitions/{cid}/organisations/{oid}` write, which an organisation's admin may do
for any competition, as the app lets them; a competition that takes its organisations from a primary is refused with the
primary's name). Admins and invites are not reachable. The change log for these is `organisations:changes/{organisationId}/{changeId}`:
the same entry, rules (read by the organisation's admins; written by an assistant that is one, with the change, never rewritten) and sweep as a
competition's. A competition added or removed is logged on the organisation, not the competition. `get_changes` and
`undo_change` take `organisation` instead of `competition`. `create_organisation` starts one with the person as admin and
cannot be undone: making an organisation and its admin takes the Admin SDK, so the tool calls `createOrganisation`'s handler
in the `mcp` function with the person's uid and `via: 'mcp'` (the callable itself stays closed to assistants). The handler
makes the same checks (they must manage a competition or organisation; the competition named must be theirs; dedup is by full name, a short
name may be shared) and, for an assistant, none of the system admin shortcuts (`join: false`, `grantSubmitter`). The tool refuses
text longer than the callable keeps rather than letting it be cut short.

**Linked competitions: not built.** `linkCompetitions` (link, unlink, primary, sync a part, dry run) acts through the Admin SDK on
several competitions at once, with a system admin shortcut, and what it does is not undoable by the change log: linking
copies the primary's staff and details over the other competition's own (staff is a whole list, replaced), and triggers
then keep copying every later edit. Unlinking keeps what was copied, so it does not put anything back. It could be reached
the way `create_organisation` is, with a dry-run the assistant must show first, but a dry run only previews; the loss is not
recoverable, so it stays in the app, where Manage shows the preview and asks.

### 11. Adding a competition

`add_competition` files `competitions:submissions/{id}` as the person, through the rules (a submission needs only a signed-in
user), with the same fields as the Add a competition form (country, date, name, town, venue, space, address, registration
number, organisations that already exist, their name, a note for the reviewer, "comes as is"). The submission trigger sees the
person as the submitter (verified in the emulator over REST with the ID token), approves a tidy one on arrival, which makes the
competition and the person its admin, or holds it with its reasons. The tool reads what the form would and does not write what the
trigger writes.

- Checks: the form's (name, a real date, a town) and the rules' (`competitions:submissions` `.validate`). Nothing else is refused: a
  name in capitals or a date that has passed is sent and held for review, as the form sends them.
- Registration numbers are saved as the form's preview shows them (`tidyRegistration`, the server's copy), and the reply says so.
- Duplicates: as the form does after the date, it looks at competitions on that day (a day either side) in that country; one with a name,
  venue and town alike (`sameCompetition`, shared with the form in `shared/knownCompetitions.ts`) refuses the call, naming it, unless the
  organiser says it is another (`notTheOneAlreadyHere`). Others that day are listed in the reply. A listed competition (ADR 0009) that
  matches fills a venue, address or organisations left out, never one given.
- Venue: the form's place lookup is Google Places in the browser, billed per use, which a function should not run. The submission
  carries the country (and a UK nation's region) as the form puts it. When the venue and town are one the app already knows (the `venues:index`
  the form uses for a known competition), the pin and locality come from that venue. Otherwise there is no pin, the reply says so, and the
  organiser adds one in Details (or a system admin's `backfillCoords` geocodes it).
- The reply says whether it was added (the tool waits up to 30 s, 50 s in the emulator, 8 s when the checks already show a person must look, for the
  competition to appear among the person's own, since the submission itself cannot be read back) with its id and a link to
  Manage, or sent and waiting, with the checks it will likely fail, in the app's words ("usually approved overnight"; an
  email follows either way).
- Not undoable, and not editable until approved: the tool's description and the instructions say to confirm every detail and show the
  line to accept first. A second day of the same event is `sameWeekendAs` (the first submission's id), which the trigger turns into a link
  once both are approved.

### 12. Every tool, and what assistants cannot do

Read: `get_competitions`, `get_competition`, `get_dances`, `get_dancers`, `get_staff`, `get_schedule`, `get_results` (with each row's judges' sheet link, §14), `find`,
`get_organisations`, `get_changes`.
Write: `update_competition`, `set_visibility`, `save_dances`, `save_dancers`, `save_staff`, `remove`, `save_results`, `save_draws`,
`save_schedule`, `draft_dancers` (files a list for the organiser to import; changes nothing), `update_organisation`,
`undo_change`, and two that cannot be undone: `create_organisation`, `add_competition`.

AI assistants cannot: invite, remove or promote admins or organisers (competitions or organisations); delete a competition or an
organisation; upload anything (photos, logos, link files, judges' sheets) or remove judges' sheets; link, unlink or re-share linked
competitions; approve or reject submissions or edit a submission after sending it; call any callable; use any system admin
tool, even for a system admin (their assistant has only the competitions and organisations they were made an admin of); touch the
person's own account (favourites, alerts, push tokens, dancer colours), connections, tool links or sign-in records; or read or
change anything about a competition or organisation the person does not manage.

### 13. What an assistant changed, in Account

The full entries live in each competition's and organisation's log, which is the right place for undo but a poor one for "what did this
assistant do lately": a person manages many. So each change also writes a small index entry in the **same atomic update**:

    users:changes/{uid}/{connectionId}/{changeId} = { at, scope: 'competitions'|'organisations', scopeId, summary, undoOf?, undone? }

`scope` and `scopeId` say where the full entry is (`{scope}:changes/{scopeId}/{changeId}`), so an Undo button could be added to the sheet later.
`undone` (a time) is kept in step when the person's assistant undoes their own change; an undo is itself an entry with `undoOf`. Keyed by
connection so the sheet reads one assistant's latest with an `at` index and `limitToLast`, and "show more" raises the limit (20 at a time).
Rules: the person reads it (their assistant session can too, since `undo_change` checks an entry is there before marking it; nobody else);
an assistant session may add its person's own entries, validated, never rewrite or delete one, and set `undone` once; the person may delete
the whole of it (deleting their account). A change another person's assistant undoes is not marked in the first person's index (it cannot
write there): the original entry in the log is. Changes made before the index existed are not listed.

The sheet (`AssistantChanges.vue`) is view only: summary, which competition or organisation (by name, read from the public record; "gone"
for one deleted), when, and whether it was undone. Undo is done by asking the assistant. Entries, and the index, are kept 30 days.

### 14. Judges' sheets, draws

- An assistant cannot upload a judges' sheet (a connector has no way to receive a file). `get_results` gives each dance and overall a
  `judgesSheet: { pages, addInApp }`, where `addInApp` is the link to that age group and row in Manage › Results (`/competitions/{id}/manage/results/{ageGroupId}/{danceId|overall}`),
  and the instructions tell the assistant to hand it to the organiser.
- A "gap" in a draw is not a feature of the app. The old admin saved draws cell by cell and could leave empty cells; the app skips them
  when it shows a draw and drops them on the next save, and never writes one. `save_draws` therefore sets no gap, and `get_results` reads a draw
  as the app does (`drawList` in `shared/plans/draws.ts`, also used by `storedDraw`): gaps left out, a sparse draw read in order. A gap between
  age groups is a schedule feature, and `save_schedule` already takes it (`{ gap: true }`).
