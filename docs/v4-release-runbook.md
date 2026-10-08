# v4 release runbook

How the new consumer app (`web/`) gets from this branch to production. Each
phase can be rolled back on its own. See ADR 0001 for the cutover design and
ADR 0003 for the aggregates.

## Where things stand (2026-10-02)

- Phases 0 and 1 are done: `next` is on next.scotdance.app, and production
  has this branch's rules and functions and the backfilled data.
  - Backfills (2026-10-02, Friday evening): map positions 3 updated; dancers
    116,914 entries linked, venues 775, judges 1,615, pipers 543, each re-run
    to `written: 0` and `pruned: 0`; 729 published and 783 listed
    competitions; search indexes rebuilt for competitions (824), judges
    (1,638) and pipers (548). `reindexDancers` left alone.
  - Checked on next.scotdance.app: search (signed in and out), a dancer page
    with results, Follow and unfollow, old favourites carried over, a judge
    page and results signed out. On scotdance.app (v3), signed out: a
    competition's dancers and info.
- Still to check: a dancer search in the v3 app signed in as a non-admin (v3
  needs sign-in for dancer search).
- Next: Phase 2 (real devices), then Phase 3.

## Phase 0: code onto `next`

1. Squash this branch onto `next` (one commit per design round).
2. Push `next`. GitHub Actions deploys **next.scotdance.app** (staging, real data).

## Phase 1: backend on the shared project

`firebase login --reauth` first; run from the repo root.

1. `firebase deploy --only database` (rules).
2. `firebase deploy --only functions` (predeploy lints and builds). They're
   2nd gen on Node 24 since 2026-10-03 (`functions/package.json` `engines`;
   `functions/src/utility/triggers.ts` keeps the 1st gen handler shapes), and
   run as `firebase-scotdance@appspot.gserviceaccount.com` like 1st gen did.
   Function names are the API: the v3 apps call `searchDancers` by name, so
   never rename one. Any local Node from 24 up can deploy.
   `RUNTIME_CONFIG` must hold `typesense.host` / `typesense.api_key` (already
   used by `searchDancers`, so it should exist). `GOOGLE_GEOCODING_API_KEY`
   must exist in Secret Manager too (`backfillCoords` declares it).
3. Backfills, from next.scotdance.app/admin/tools (signed in as a system admin),
   at a time with no competition running. Each one is safe to re-run; if one
   stops part way, run it again.
   1. `backfillCoords`, `{ dryRun: true }` first, then for real: map positions
      and countries for competitions submitted without a place. Before the
      venues, so they're keyed by town from the start. (The dry run still calls
      Google's geocoder.)
   2. For dancers, then venues, judges and pipers: `backfill…Aggregates`, then
      `backfill…BackPointers`, re-run until it reports `written: 0`. The
      back-pointers aren't optional: Follow reads the `dancerId` / `judgeId` /
      `piperId` they write.
   3. `reindexCompetitionsPublished` ("Published and listed competitions lists"): builds the new `competitions:listed` list, so search finds listed competitions (and their judges and pipers) before they're published
   4. `reindexCompetitions`, `reindexJudges`, `reindexPipers` (Typesense, for `searchAll`)
   5. Run each `backfill…Aggregates` once more: it should report `pruned: 0`
      (an edit made during the first run can leave a stray).
   Run each Aggregates/BackPointers pair back to back, and don't unpublish
   anything meanwhile. Leave `reindexDancers` alone: it empties the collection
   the v3 apps' dancer search reads before rebuilding it.
4. Check next.scotdance.app: search by name and number, a dancer page, Follow,
   a judge page, results on a past competition. Then a dancer search in the v3
   app signed in as a non-admin (its filter values are quoted differently now).

Old favourites (keyed by per-competition dancer ids) are copied to aggregate
ids on first load, so the dancer backfill must finish before people use v4.
The old keys stay, so the v3 app keeps its stars.

## Phase 2: real devices

next.scotdance.app on an iPhone (Safari) and an Android phone: Home with
followed dancers, a competition on the day (`?now=` doesn't work in prod
builds, so use a live or recent one), the More menu, the morphing sheets, the
glass tab bar, Back out of a competition, dark mode, large text.

## Early access (before cutover)

People try v4 only if they choose to; everyone else stays on v3 until the
stores release it. On a phone it replaces the v3 app (same app ID).

- iPhone: a TestFlight public link on an external group, open to anyone, no
  limit. The first build needs TestFlight review. Required: a Beta App
  Description ("The new ScotDance.app, nearly here. Help shape it for Highland
  dance families: share your ideas from the More menu.") and a Feedback Email.
- Android: Play open testing. Anyone with the link, or the "Join the beta" box
  on the Play listing, can join. Set the track's feedback email.
- Web: next.scotdance.app.
- Getting the word out: v3 (3.15.0 on `develop`, in the apps and on
  scotdance.app) has a dismissible banner. Each platform shows it once its link
  is set in `production/featureFlags/next-banner/{web,ios,android}` (live, no
  release needed; delete a link to hide it there):
  - `web`: `https://next.scotdance.app` (the banner opens the same page there)
  - `ios`: the TestFlight public link
  - `android`: `https://play.google.com/apps/testing/info.mismith.scotdance`
  - e.g. `firebase database:set /production/featureFlags/next-banner/web --data
    '"https://next.scotdance.app"' --instance scotdance -f`
  - Deploy v3's web with `firebase deploy --only hosting` from `develop`
    (after `npm ci && npm run build:www`, with `.env.local` copied from the
    repo root). Never `npm run deploy` there: it would put v3's rules and
    functions back over v4's.
- Feedback: while the app's version is ahead of `versions/*` (TestFlight, Play
  testing, next.scotdance.app), More (and the sidebar) has "Share your ideas",
  with a dot on More until it's first opened. It opens the Help chat; Crisp
  shows each conversation's version and platform.

## Phase 3: cutover (ADR 0001 checklist)

- [x] Hosting: the `production` target serves `web/dist` like `next` does (done on `next`, where the old app is gone; admin is in the app now, ADR 0004, so there's no `/admin/**` rewrite; old `#/` and `/competitions/:id/admin` links redirect in-app). To go live from `next`: `npm run build`, then `firebase deploy --only hosting:production`
- [x] `capacitor.config.json` `webDir`: `www` → `web/dist` (done on `next`); before a store build, run `npm run build` at the root: it builds `web/` and runs `cap sync` (this also clears any live-reload URL)
- [x] Cache headers: HTML `no-cache`, hashed assets `immutable`, and `ignore` that keeps `/.well-known/` (both targets in `firebase.json`)
- [ ] Rebuild and submit the iOS and Android apps (all plugins are already installed)
  - iOS uses Swift Package Manager now: open `ios/App/App.xcodeproj` (no workspace, no `pod install`)
  - The update prompt compares `web/package.json`'s version with `versions/ios`, `versions/android` and (on the web) `versions/web` in the database; `set-version.js` only bumps the root and native versions, so bump `web/package.json` to match. Both are `4.0.0` now (Android versionCode 4000000). Release each store's version by hand (App Store: "Manually release this version"; Play: managed publishing), then set that platform's version to `4.0.0` in System admin › Tools straight away: earlier, everyone on the old app is told to update to something they can't get yet; later, people who got 4.0.0 still see "Share your ideas" (the app counts as early while it's ahead of `versions/*`). `versions/web` sets itself: the `production` hosting target's postdeploy runs `publish-web-version.js`
  - Vite reads env files from `web/`, not the repo root: create `web/.env.local` with `VITE_GOOGLE_MAPS_API_KEY` before a local store build, or the apps ship without venue search. The key's referrer restrictions need the app origins too (`capacitor://localhost` on iOS, `https://localhost` on Android)
  - Smoke test on a device: splash hides, status bar follows dark mode, Android Back closes sheets, airplane mode opens the last saved data
  - Saved passwords with Face ID or a fingerprint: the iOS app has the Associated Domains entitlement (`webcredentials:scotdance.app`) and the Android app an `asset_statements` link, so the sign-in sheet offers people's saved scotdance.app passwords. Both need `/.well-known/` on scotdance.app: live since 2026-10-02, deployed from `develop` so it's there before the apps ship. `assetlinks.json` already has the Play app-signing SHA-256 (Play Console › Protected with Play; re-check it if the signing key ever changes). If Xcode's automatic signing can't add Associated Domains to the App ID, turn it on at developer.apple.com
- [x] "Manage competitions" in v4 opens `/manage` in the app
- [ ] Organiser dry run on next.scotdance.app: submit, approve (sends a real email), invite a second admin, import an Excel sheet, enter results on a phone
- [ ] Google Maps key has the Places API enabled (venue search in Manage › Details), with a daily quota cap: the key ships in the app, so referrer limits alone can't stop someone reusing it
- [ ] Privacy page mentions the private colour picks

Rollback: `develop` still has the v3 app. Check it out, `npm ci && npm run build:www`, then `firebase deploy --only hosting`. Then set `versions/web` back to v3's (3.14.1) in Tools: the v4 deploy set it to 4.0.0, and v3 would ask everyone on the web to update.

## Local testing gotchas

- `npm run local` (in `web/`) handles the awkward parts: it runs the stack
  on the Node version in `.nvmrc` (24, as in production), one function at a
  time (`--inspect-functions`, so a test run's burst of triggers can't swamp
  it), Typesense from Docker, and Vite on :5273. It needs Docker running
  (OrbStack) and Node 24 installed with nvm.
- `firebase.json` names the database instance (`scotdance`), so the emulator
  applies the rules (and the `date` index the competitions list needs) even
  when the CLI's login has expired.
- `functions/.secret.local` needs `RUNTIME_CONFIG={}`. Without it the emulator
  fetches the real `RUNTIME_CONFIG` from Secret Manager, and invite and
  approval emails really go out through Postmark (to admin@scotdance.app).
- Vite reads env files from `web/`: the Maps key goes in `web/.env.local`
  (venue search in Manage › Details needs it).
- E2E: `npm run e2e` in `web/` against a running `npm run local`
  (`E2E_BASE_URL` / `E2E_EMULATOR_PORT_OFFSET` point it at another stack).

## Organisations and push alerts (if they ship with v4)

Prototype on branch `claude/v4-orgs-push`; design in ADR 0005 (organisations)
and ADR 0006 (push alerts). Done already (2026-10-04): the APNs key is in
Firebase, `GoogleService-Info.plist` is in the iOS app, and its push, Time
Sensitive and background capabilities are on.

Merging to `next` deploys next.scotdance.app (staging, on the real backend),
so the backend goes first, from the branch, after Phase 1's steps:

1. `firebase deploy --only database,storage` (organisations, device tokens,
   the dancers `groupId` index; organisation logos and files).
2. `firebase deploy --only functions` (`createOrganisation`,
   `organisationInvite*`, `organisationDeleted`, the alert triggers, the
   `sendResultAlerts` Cloud Tasks queue and the hourly `morningSummaries`,
   which makes a Cloud Scheduler job). Then enter a test result on a
   published competition you follow and check `sendResultAlerts` ran in the
   functions logs: it's the one part the emulator can't prove (its URL
   lookup and invoker permission).
3. Merge to `next`. The web deploys, and `.github/workflows/postmark.yml`
   pushes the email templates in `postmark/` (the source of truth; it needs
   the `POSTMARK_SERVER_TOKEN` repo secret, the server's API token).
4. System admin › Tools › Alerts › Followers: Rebuild, once.
5. Done 2026-10-06: System admin › Tools › Competitions search, after the
   functions deploy that indexes each competition's organisations. Rebuild it
   again only when the index's fields change.
6. System admin › Organisations › Tag: this season's competitions first.
7. TestFlight / Play internal testing on real phones before the app ships:
   follow a dancer, enter a result in Manage, wait a minute.

Until cutover, emailed links open scotdance.app, which is still v3: an
organisation invite's email link lands where there are no organisations.
On staging, send people the invite's Copy link instead (it opens
next.scotdance.app).

## Rejecting submissions

Approve or Reject in System admin › Submissions; a rejection's reply is
emailed by `competitionSubmissionUpdated` with the new
`competition-submission-rejected` template. The backend goes first, from the
branch:

1. `firebase deploy --only database` (a submitter can't send one already
   rejected, or with a reply of its own).
2. `firebase deploy --only functions:competitionSubmissionUpdated`.
3. Merge to `next`: the web deploys and the template is pushed. Then submit a
   competition yourself, reject it with a reply, and check the email arrives
   and the submission says "Emailed".

## Approving submissions as they arrive

A new submission is checked as it arrives (`functions/src/review.ts`): with
nothing to look at, it's approved there and then, and admin@ gets
`competition-submission-auto-approved` with a link to manage it. There's no
undo: anything wrong is fixed in Manage. Otherwise it waits, and says why
(Needs a look, in System admin › Submissions). Registration numbers are tidied
into each association's format as they're saved
(`competitionRegistrationChanged`, and in the submission itself).

1. Merge to `next` first: the web (Needs a look) deploys and the new and
   changed templates are pushed, so nothing sends a template Postmark
   doesn't have yet.
2. `firebase deploy --only database` (the index on `competition/date`; a
   submitter can't say it's approved or needs no review).
3. `firebase deploy --only functions:competitionSubmissionCreated,functions:competitionSubmissionUpdated,functions:competitionRegistrationChanged`.
4. The numbers already there were tidied once, on 2026-10-06 (89 of 739,
   after a before-and-after was checked; backup and restore file in
   `~/Sites/@mismith/scotdance-backups/2026-10-06-registration-numbers`). The
   trigger keeps them tidy after that.
5. Submit a tidy competition yourself: it should be approved within seconds,
   with both emails.

## Parked

- Tartans: branch `claude/tartans-parked`, as a future optional side tool.
