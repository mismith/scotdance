# v4 release runbook

How the new consumer app (`web/`) gets from this branch to production. Each
phase can be rolled back on its own. See ADR 0001 for the cutover design and
ADR 0003 for the aggregates.

## Where things stand (2026-09-30)

- `web/` builds clean; `functions/` lints, typechecks and builds clean.
- Production still runs the v3 backend. Missing there, and needed by v4:
  - **Rules** from this branch: public reads for `dancers`, `judges`, `pipers`,
    `venues` (+ `:index`), and private `users:dancerColors`. Purely additive,
    so v3 keeps working.
  - **Functions**: `searchAll`, the `*Aggregates` / `*BackPointers` backfills,
    `reindexCompetitions` / `reindexJudges` / `reindexPipers`, and the
    judge/piper/venue triggers. (Probed 2026-09-30: `searchAll` 404s in prod.)
  - **Data**: the aggregates (`/dancers`, `/judges`, `/pipers`, `/venues`) and
    the back-pointers on competition records, built by the backfills.
- So next.scotdance.app (which reads production data) half works today:
  competitions and results yes; search, people pages and Follow no.

## Phase 0: code onto `next`

1. Squash this branch onto `next` (one commit per design round).
2. Push `next`. GitHub Actions deploys **next.scotdance.app** (staging, real data).

## Phase 1: backend on the shared project

`firebase login --reauth` first; run from the repo root.

1. `firebase deploy --only database` (rules; additive).
2. `firebase deploy --only functions` (predeploy lints and builds).
   `RUNTIME_CONFIG` must hold `typesense.host` / `typesense.api_key` (already
   used by `searchDancers`, so it should exist).
3. Backfills, from the `next` admin (Admin › Info › Aggregators, signed in as an
   admin; run the old app locally from this branch if prod's admin predates it):
   1. `backfillDancerAggregates`, then `backfillDancerBackPointers`
   2. the same pair for venues, judges and pipers
   3. `reindexCompetitions`, `reindexJudges`, `reindexPipers` (Typesense, for `searchAll`)
4. Check next.scotdance.app: search by name and number, a dancer page, Follow,
   a judge page, results on a past competition.

Old favourites (keyed by per-competition dancer ids) migrate to aggregate ids
on first load, so the dancer backfill must finish before people use v4.

## Phase 2: real devices

next.scotdance.app on an iPhone (Safari) and an Android phone: Home with
followed dancers, a competition on the day (`?now=` doesn't work in prod
builds, so use a live or recent one), the More menu, the morphing sheets, the
glass tab bar, Back out of a competition, dark mode, large text.

## Phase 3: cutover (ADR 0001 checklist)

- [ ] Hosting: `/admin/**` → old app (`www/`), everything else → `web/dist/`
- [ ] Old app's router base `/admin`, asset paths updated
- [x] `capacitor.config.json` `webDir`: `www` → `web/dist` (done on `next`); before a store build, `npm run build` in `web/` then `npx cap sync` (this also clears any live-reload URL)
- [ ] Cache headers: HTML `no-cache`, hashed assets `immutable`
- [ ] Rebuild and submit the iOS and Android apps (all plugins are already installed)
  - iOS uses Swift Package Manager now: open `ios/App/App.xcodeproj` (no workspace, no `pod install`)
  - The update prompt compares `web/package.json`'s version with `versions/ios` and `versions/android` in the database; `set-version.js` only bumps the root and native versions, so bump `web/package.json` to match
  - Smoke test on a device: splash hides, status bar follows dark mode, Android Back closes sheets, airplane mode opens the last saved data
- [ ] "Manage competitions" in v4 opens `/admin`
- [ ] Privacy page mentions the private colour picks

Rollback: revert the hosting rewrites and `webDir`, redeploy hosting.

## Parked

- Push alerts: branch `claude/front-row-push-alerts` (needs rebasing).
- Tartans: branch `claude/tartans-parked`, as a future optional side tool.
