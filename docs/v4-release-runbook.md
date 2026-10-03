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
2. `firebase deploy --only functions` (predeploy lints and builds). They run
   on Node 24 (`functions/package.json` `engines`; Cloud Functions has no
   Node 26 yet). Any local Node from 24 up can deploy: the old
   `buffer-equal-constant-time` failure on Node 26 went with the 2026-10-02
   dependency upgrade.
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

## Phase 3: cutover (ADR 0001 checklist)

- [ ] Hosting: the `production` target serves `web/dist` like `next` does (admin is in the app now, ADR 0004, so there's no `/admin/**` rewrite; old `#/` and `/competitions/:id/admin` links redirect in-app)
- [x] `capacitor.config.json` `webDir`: `www` → `web/dist` (done on `next`); before a store build, `npm run build` in `web/` then `npx cap sync` (this also clears any live-reload URL)
- [ ] Cache headers: HTML `no-cache`, hashed assets `immutable` (done for `next` in `firebase.json`; copy its `headers` and `ignore` to `production` with the switch above, or `/.well-known/` won't deploy)
- [ ] Rebuild and submit the iOS and Android apps (all plugins are already installed)
  - iOS uses Swift Package Manager now: open `ios/App/App.xcodeproj` (no workspace, no `pod install`)
  - The update prompt compares `web/package.json`'s version with `versions/ios`, `versions/android` and (on the web) `versions/web` in the database; `set-version.js` only bumps the root and native versions, so bump `web/package.json` to match. Both are `4.0.0` now (Android versionCode 4000000); set `versions/*` to `4.0.0` only once each store has the build, or everyone on the old app is told to update to something they can't get yet
  - Vite reads env files from `web/`, not the repo root: create `web/.env.local` with `VITE_GOOGLE_MAPS_API_KEY` before a local store build, or the apps ship without venue search. The key's referrer restrictions need the app origins too (`capacitor://localhost` on iOS, `https://localhost` on Android)
  - Smoke test on a device: splash hides, status bar follows dark mode, Android Back closes sheets, airplane mode opens the last saved data
  - Saved passwords with Face ID or a fingerprint: the iOS app has the Associated Domains entitlement (`webcredentials:scotdance.app`) and the Android app an `asset_statements` link, so the sign-in sheet offers people's saved scotdance.app passwords. Both need `web/public/.well-known/` live on scotdance.app (deploy it to the current site too if the apps ship first). `assetlinks.json` already has the Play app-signing SHA-256 (Play Console › Protected with Play; re-check it if the signing key ever changes). If Xcode's automatic signing can't add Associated Domains to the App ID, turn it on at developer.apple.com
- [x] "Manage competitions" in v4 opens `/manage` in the app
- [ ] Organiser dry run on next.scotdance.app: submit, approve (sends a real email), invite a second admin, import an Excel sheet, enter results on a phone
- [ ] Google Maps key has the Places API enabled (venue search in Manage › Details), with a daily quota cap: the key ships in the app, so referrer limits alone can't stop someone reusing it
- [ ] Privacy page mentions the private colour picks

Rollback: revert the hosting rewrites and `webDir`, redeploy hosting.

## Local testing gotchas

- `npm run local` (in `web/`) handles the awkward parts: it runs the stack
  on the Node version in `.nvmrc` (24, as in production), one function at a
  time (`--inspect-functions`, so a test run's burst of triggers can't swamp
  it), Typesense from Docker (the repo's `typesense-server` binary is
  Intel-only), and Vite on :5273. It needs Docker running (OrbStack) and
  Node 24 installed with nvm.
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

## Parked

- Push alerts: branch `claude/front-row-push-alerts` (needs rebasing).
- Tartans: branch `claude/tartans-parked`, as a future optional side tool.
