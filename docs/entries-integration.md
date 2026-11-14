# Entries integration

ADR 0019 gives ScotDance ownership of people, organisation admins and public competition details. Entries owns registration and payments. This bridge uses their existing shared `TOOL_PASS_SECRET`; it never accepts an Entries Firebase token as a ScotDance login.

## Structured program occurrences (local implementation, not deployed)

The signed `dances` action also accepts `occurrenceId` and optional `canonicalDanceId` on every dance.
When occurrence IDs are supplied, each occurrence remains separate even when its name and steps match
another one (for example the ordinary and trophy Fling). The source stores the provenance as
`entriesOccurrenceId` and `entriesCanonicalDanceId`; its own dance keys remain source-owned.
Mixed legacy/structured payloads, duplicate occurrence IDs and invalid IDs are rejected.
The existing empty-list transaction and current organiser-permission checks remain in force.
Legacy payloads continue deduplicating by name and steps.

Entries selects a single competition instance and calls its `sourceCompetitionId`; it must not send a
weekend's combined dance list to one day's competition. Splits continues to receive its version 1 solo
age-list contract, with the selected source competition as the destination and an age calculated from
the enrollment's saved reference date. Group rosters remain separate from solo age splitting. Binder's
verified-email, explicit saved-dancer copy requires no change for this extension.

Validate with `npm --prefix functions run build`,
`node --test functions/dist/functions/src/entriesDances.test.js`, and
`npm --prefix web test -- src/lib/__tests__/functionsEntriesBridge.test.ts --configLoader runner`.

## Sign in and return

The `entries` tool pass includes `competitions: [{ id, name, date }]` for upcoming competitions the person explicitly manages. Unlisted competitions are included. Other tool passes do not receive this list.

Entries opens `/competitions/add?returnTo=entries`. Only this literal return intent is supported. It is stored on the submission; after approval has created the organisation and granted access, `entriesReady: true` lets the submitter's open tab return. The approval email uses the same address:

`https://entries.scotdance.app/organise?competition=<id>&refresh=1`

Organisation Manage links to `/organise?organisation=<id>&refresh=1`. New organisations requested in a submission still require review. Existing trusted-organiser creation remains unchanged.

## Signed server requests

`entriesCompetition({ pass })` accepts a JWT with:

- Header: `alg: HS256`, `typ: JWT`.
- Issuer: `https://entries.scotdance.app`; audience: `scotdance:entries`.
- `sub`: the acting ScotDance uid; `iat`, `exp` at most 120 seconds apart; a nonempty `jti`.
- `action`, `competitionId`, `organisationId`, and all action fields inside the signed payload.

Actions:

| Action | Additional fields | Response |
| --- | --- | --- |
| `inspect` | None | Public competition/organisation snapshots and `registrationTargetId`; requires current admin rights to both. |
| `claim` | None; human `sub` | Public competition/organisation snapshots plus `registrationTargetId`, `bindingId`, `revision` (initially zero). Checks current competition, organisation and primary permissions. Repeating the same claim preserves its binding. |
| `snapshot` | None | Only public competition/organisation snapshots, for scheduled refresh. No participant or account information is returned. |
| `registration` | `registrationURL`, nullable `registrationStart`/`registrationEnd` in milliseconds, increasing integer `revision`; ongoing service requests use `authority: service`, `sub: entries-service`, and `bindingId` | `registrationTargetId`, applied `revision`, `applied`. |
| `unlink` | Human `sub`, matching `bindingId` | Rechecks live permission, clears registration and matching ownership copies, returns `released: true`. Repeated release is harmless; another owner/binding is refused. |
| `dances` | `dances: [{ name, steps? }]`, at most 200 | `sent`: count of distinct names/steps inserted. |

Registration resolves shared fields to the current primary and requires permission to that primary too. Its `entriesRegistration` marker records the source competition, organisation, target and revision. Another Entries source is rejected. A repeated/older revision cannot overwrite newer settings. Browser and assistant writes cannot edit or delete the managed fields or ownership marker. Linked registration copies include the marker; stopping sharing releases inherited ownership while retaining the displayed dates.

Changing the primary moves the authoritative registration and updates every shared ownership target, even when mirrored copies have not caught up. If the Entries source stops sharing or its primary leaves, its latest registration moves back to that source and the other copies lose their inherited lock. Overlapping propagation deliveries cannot regress a newer copied revision.

Registration URLs must exactly name `/enter/<organisationId>/<competitionId>` on `https://entries.scotdance.app`. Only in emulators, `http://localhost:5290` and `http://127.0.0.1:5290` are also accepted.

Once a human with current access establishes a binding, Entries can keep publishing that connection without
depending on the last editor retaining access. Service requests cannot claim an unowned competition or
change its owning organisation. Unlink/reconnect creates a fresh binding, invalidating earlier jobs. The
server-owned released-binding marker prevents delayed mirror updates from reinstating a released connection.

Dance publication uses a transaction on the destination list. It never overwrites an existing list, including one populated concurrently. Identical name/steps pairs across categories become one dance; different steps remain separate.

## Membership changes

`entriesOrganisationMembership` watches organisation admin grants/removals and calls Entries' `syncScotDanceMembership({ pass })` with:

- Issuer `https://scotdance.app`, audience `entries:membership`, `sub` uid.
- `organisationId`, current `allowed` boolean, monotonic per-person/per-organisation `checkedAt` milliseconds.
- The same HS256 secret, two-minute lifetime and unique `jti`.

Every attempt rereads current authority. The receiver must retain the latest `checkedAt`, ignore older deliveries and prevent an older sign-in pass from restoring removed access. Native event retries are supplemented by `retryEntriesMembership` every five minutes. Failed deliveries stay in the server-only `entries:membershipFailures` tree until acknowledged; version stamps stay in `entries:membershipVersions`.

## Account deletion

Ordinary tool unlink only revokes sessions. Account deletion has a distinct signed audience, `entries:delete`,
with `sub` and `deletedAt`, sent to Entries' `deleteScotDanceAccount`. The `auth-hooks` codebase records actual
Firebase Auth deletion events in `entries:accountDeletions/{uid}`. `deliverEntriesAccountDeletion` sends newly
queued requests; `retryEntriesAccountDeletion` reads at most 100 indexed pending requests every five minutes,
with a 45-second work budget. Completed requests
retain a small server-only acknowledgement so repeated Auth events cannot start a different deletion.

Entries keeps a permanent server-only `deletedAccounts/{uid}` tombstone to block stale sign-in passes and
in-flight writes. It deletes the saved parent/dancer profile tree, memberships, pending notifications and Auth
account; removes birthdays, contact/location data and correction history; and retains paid roster names,
categories and age at the competition plus the financial audit. Pending payments retain that minimal roster
until reconciliation settles or expires them. Deletion never silently withdraws or refunds a paid entry.

Firebase Auth deletion events are still first-generation and Node 24 is supported only for second-generation
functions, so the tiny Auth hook uses Node 22 while the existing backend stays on Node 24. Its lockfile pins
the compatible database dependency. See [Firebase Auth events](https://firebase.google.com/docs/functions/1st-gen/auth-events)
and [Google's runtime support table](https://docs.cloud.google.com/functions/docs/runtime-support).

## Splits destination

`ScotDance.send({ source, name, text, competitionId? })` preserves an optional destination through the embed. The connect page validates it against the person's managed competitions and checks permission again before writing the inbox. An unavailable destination is explained rather than replaced with a different competition. The organiser still taps to open the normal import preview.

Grouped CSV exports with explicit `Number,Full name,Location,Studio` or `Number,First name,Last name,Location,Studio` headings are supported, including empty cells. Legacy files retain their existing detection.

## Local checks and deployment

Use the repository's Node 24 environment. From the repository root:

```sh
npm --prefix functions run build
npm --prefix web test
npm --prefix web run build
```

With the local emulators and Vite running, from `web`:

```sh
E2E_BASE_URL=http://localhost:5279 npx playwright test e2e/backend-rules.spec.ts e2e/connect.spec.ts --project=desktop
```

Set `E2E_EMULATOR_PORT_OFFSET` to match a shifted emulator stack. For local Entries integration set `ENTRIES_MEMBERSHIP_URL` to the Entries emulator's `syncScotDanceMembership` callable, and `ENTRIES_ORIGIN` (functions) / `VITE_ENTRIES_ORIGIN` (web) to `http://localhost:5290`. Without a local membership URL, emulated permission changes never call the live Entries service.

The real cross-app contract test uses the compiled Entries signer and both running emulators:

```sh
node web/scripts/entries-contract.cjs
```

It expects a sibling `entries` checkout (override with `ENTRIES_TEST_REPOSITORY`), its built functions, and
its ignored `functions/.secret.local` containing the same `TOOL_PASS_SECRET` as ScotDance's emulator.
ScotDance uses project `firebase-scotdance`, functions port 5001 and database port 9009. Entries uses project
`demo-entries` (override with `ENTRIES_TEST_PROJECT`), functions port 5201 and Firestore port 8380. Start the
ScotDance emulator with `ENTRIES_MEMBERSHIP_URL=http://127.0.0.1:5201/demo-entries/us-central1/syncScotDanceMembership`.
The script sets its source URL only in its own process, leaving Entries' sample stub unchanged. It tests
inspection, shared registration publication, atomic dance seeding, second-send refusal, and actual membership
grant/removal triggers. Fixtures have unique IDs and are removed in `finally`; credentials are never printed.
Install the isolated Auth hook with Node 22 and `npm --prefix auth-hooks ci`. The extended test also covers
the actual Entries link/refresh services consuming the claim snapshot, service publishing after the editor loses
access, unlink/reconnect replay protection, and the real
Auth hook handler → durable queue → signed receiver deletion path. It invokes the Auth event handler directly
so it can run against an emulator stack started before the new codebase was registered. Set
`ENTRIES_ACCOUNT_DELETE_URL=http://127.0.0.1:5201/demo-entries/us-central1/deleteScotDanceAccount` on a restarted
ScotDance emulator to exercise automatic delivery of actual Auth deletion events too.

For the lifecycle repair release, deploy source rules and `entriesCompetition`, `linkCompetitions`,
`competitionDetailsSync`, `competitionDeleted` before Entries begins claiming bindings. Deploy the Entries
`deleteScotDanceAccount` receiver before enabling `deliverEntriesAccountDeletion`, `retryEntriesAccountDeletion`
and the isolated `functions:auth-hooks` producer. Existing source UI screens do not require rebuilding for this repair.

Deploy receivers and rules before enabling producers: ScotDance `entriesCompetition` and registration protections; Entries `syncScotDanceMembership`; then the membership trigger/sweep and Entries publication. Deploy ScotDance's updated embed/importer before Splits starts sending explicit destination IDs and studio columns. The existing `next` branch workflow only deploys hosting; functions and rules must be released explicitly.

For the initial release, Entries and Splits use `https://next.scotdance.app` for the source UI and embed. The JWT issuer remains `https://scotdance.app`. Deploy only `hosting:next`; the `production` hosting target serves the existing legacy application and must not receive this build unintentionally. The shared backend changes are scoped to:

```sh
firebase deploy --project firebase-scotdance --only database,functions:entriesCompetition,functions:toolPass,functions:entriesOrganisationMembership,functions:retryEntriesMembership,functions:linkCompetitions,functions:competitionDetailsSync,functions:competitionDeleted,functions:competitionSubmissionUpdated,functions:mcp
firebase deploy --project firebase-scotdance --only hosting:next
```

The first membership-trigger deployment asks to acknowledge its retry policy. For an unattended, scoped
deployment, add `--non-interactive --force` to the backend command above; the monotonic membership version and
current-authority read make repeated deliveries safe.

## Released 2026-11-11

- Deployed production database rules and the nine scoped functions listed above to `firebase-scotdance`.
  The new membership receiver in Entries was deployed first. All create/update operations succeeded.
- Deployed only `hosting:next`, available at `https://next.scotdance.app`. Its live HTML exactly matched the
  production bundle; the HTML hash of `https://scotdance.app/` remained unchanged from before deployment.
- The live `entriesCompetition` endpoint returned the expected application `401 UNAUTHENTICATED` for an invalid
  signed pass, confirming that the public transport reaches its signature check.
- Signed-out desktop and phone checks passed for the live homepage and connect screen without runtime errors.
- Validation before release: 108 unit-test files / 1,739 tests at the ownership checkpoint; the final added
  target-move guard passed all 15 bridge tests. Functions lint/build and the production web build passed.
- Real emulator rules checks verified registration ownership against organiser, assistant and system-admin
  client writes, and submission readiness protections. Browser checks verified permitted destination
  preselection/import preview and refusal of a destination the account cannot manage.
- The reusable cross-app contract test passed with the actual Entries signer and both running emulators,
  including real membership grant/removal triggers and cleanup. Production signing secrets were independently
  verified equal by the release coordinator; they are not stored in this repository or these notes.

These checks verify the ScotDance side of the release. Entries payment, payout and Splits acceptance evidence
is maintained with those applications. The legacy frontend was not replaced.

## Lifecycle repair released 2026-11-12

- Deployed the binding/claim/unlink repair in `entriesCompetition`, `linkCompetitions`,
  `competitionDetailsSync` and `competitionDeleted`, together with the protected ownership rules.
  The claim response includes public snapshots, as verified through the actual Entries link and refresh services.
- After the Entries deletion receiver was deployed and reachable, released `deliverEntriesAccountDeletion`,
  `retryEntriesAccountDeletion`, the indexed pending queue and the separate Node 22
  `auth-hooks:entriesAccountDeleted`. No frontend deployment was needed.
- The full source regression checkpoint passed 108 files / 1,745 tests; the final bridge suite passed 21 tests,
  including the shared Auth-hook queuer and bounded retries. Functions lint/build, web type checking and
  real database ownership-rule checks passed. The privacy helper's three tests cover retained paid roster
  exports, removal of private data/correction history, failed Auth deletion and completed-request replay.
- The extended cross-app emulator test passed actual link/refresh, publication after the editor loses access,
  idempotent unlink, old-binding rejection after reconnect, membership changes and signed account deletion.
- An isolated production check created no-email temporary Auth accounts and a synthetic saved dancer, then
  deleted the source Auth account. The actual Auth event automatically produced a pending queue record and
  reached completed acknowledgements on both services. Entries' private profile, saved birthday and Auth
  account were gone. All temporary documents, accounts and acknowledgements were cleaned up. No orders,
  messages, real organisations or real competition records were involved in this check.
