# Entries integration

ADR 0019 gives ScotDance ownership of people, organisation admins and public competition details. Entries owns registration and payments. This bridge uses their existing shared `TOOL_PASS_SECRET`; it never accepts an Entries Firebase token as a ScotDance login.

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
| `snapshot` | None | Only public competition/organisation snapshots, for scheduled refresh. No participant or account information is returned. |
| `registration` | `registrationURL`, nullable `registrationStart`/`registrationEnd` in milliseconds, increasing integer `revision` | `registrationTargetId`, applied `revision`, `applied`. |
| `dances` | `dances: [{ name, steps? }]`, at most 200 | `sent`: count of distinct names/steps inserted. |

Registration resolves shared fields to the current primary and requires permission to that primary too. Its `entriesRegistration` marker records the source competition, organisation, target and revision. Another Entries source is rejected. A repeated/older revision cannot overwrite newer settings. Browser and assistant writes cannot edit or delete the managed fields or ownership marker. Linked registration copies include the marker; stopping sharing releases inherited ownership while retaining the displayed dates.

Registration URLs must exactly name `/enter/<organisationId>/<competitionId>` on `https://entries.scotdance.app`. Only in emulators, `http://localhost:5290` and `http://127.0.0.1:5290` are also accepted.

Dance publication uses a transaction on the destination list. It never overwrites an existing list, including one populated concurrently. Identical name/steps pairs across categories become one dance; different steps remain separate.

## Membership changes

`entriesOrganisationMembership` watches organisation admin grants/removals and calls Entries' `syncScotDanceMembership({ pass })` with:

- Issuer `https://scotdance.app`, audience `entries:membership`, `sub` uid.
- `organisationId`, current `allowed` boolean, monotonic per-person/per-organisation `checkedAt` milliseconds.
- The same HS256 secret, two-minute lifetime and unique `jti`.

Every attempt rereads current authority. The receiver must retain the latest `checkedAt`, ignore older deliveries and prevent an older sign-in pass from restoring removed access. Native event retries are supplemented by `retryEntriesMembership` every five minutes. Failed deliveries stay in the server-only `entries:membershipFailures` tree until acknowledged; version stamps stay in `entries:membershipVersions`.

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

Deploy receivers and rules before enabling producers: ScotDance `entriesCompetition` and registration protections; Entries `syncScotDanceMembership`; then the membership trigger/sweep and Entries publication. Deploy ScotDance's updated embed/importer before Splits starts sending explicit destination IDs and studio columns. The existing `next` branch workflow only deploys hosting; functions and rules must be released explicitly.
