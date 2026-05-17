# ADR-0003: First-class entity profiles (judges, pipers, venues, dancers)

Status: Implemented (pending deploy + backfill)
Date: 2026-05-16

## Context

Judges, pipers, venues, and dancers exist today only as per-competition records (and Typesense docs grouped by name at search time). Clicking a search hit picks the first comp arbitrarily; multi-comp results need a disambiguation sheet (the current `CompetitionPickerSheet`). There is no permanent URL for any of these entities, no way to link to them internally ("other comps at this venue"), and no surface to attach future data (bio, image, stats, map).

Goal: promote each kind to a first-class entity with a stable Firebase-key URL, an aggregate record materialized via Cloud Functions, and a per-kind profile page. Dancers already have a slug-based profile; this migration replaces it with the same architecture as the others.

## Decisions

### 1. Materialized aggregates, not derived

A trigger maintains an aggregate node per entity instead of deriving on every page load. Reason: enables Typesense to index one document per real-world entity (cleaner search), unlocks aggregate counts for `appearanceCount`-style filtering, and gives a single read for the profile page.

### 2. Firebase push-key IDs, not slugs

URLs are `/judges/-N1xyz`. Reason: stable across name changes, no collision risk, trivial to manipulate in DB. Slug suffix (`/judges/-N1xyz/sandra-weyman`) explicitly rejected as not worth the routing complexity.

### 3. `name:index` naming convention

`/judges/{judgeId}` for the aggregate, `/judges:index/{normalizedName}` for the dedupe lookup. Matches existing `competitions:data`, `competitions:published` conventions.

### 4. Back-pointer on per-comp records, not separate backlink index

The per-comp staff record gets a `judgeId` field directly. Reason: per-comp records (under `/competitions:data/{compId}/...`) are already lazy-loaded on demand, so the back-pointer doesn't bloat the hot-path competition meta read. A separate `/judges:byStaff/...` index would be redundant complexity.

Loop avoidance: trigger compares `before.judgeId` vs `after.judgeId` (and other meaningful fields) and no-ops when its own back-pointer write fires the trigger again.

### 5. Identity rule: normalized name only (for people)

`lowercase → strip punctuation → single-space → trim`. Two real-world people with the same name silently merge into one aggregate. Bias toward false-merge is acceptable for now — admin tooling for split/merge is deferred. For venues, see §6.

### 6. Venue identity: normalized name + locality (planned)

Venues need extra qualification because "Telus Convention Centre" exists in both Calgary and Brisbane. Rule (planned for venue phase): `normalizeName(venue) + '|' + normalizeName(locality)`. Geo proximity (50m haversine, like the map's `groupByVenue`) is not used in the trigger because it requires fetching neighbor venues to compare; locality is good enough.

### 7. Appearance shape: self-contained denorm

```
/judges/{judgeId}/appearances/{compId:staffId} = {
  competitionId, staffId,
  firstName, lastName, image, bio, location
}
```

Each appearance carries the denormed source fields. Trade-off: writes have to copy fields; reads don't have to fan out to source staff records. Aggregate-level fields (`$name`, `appearanceCount`) are derived by the trigger on each write.

### 8. Resolved fields: client-side, latest-non-null

The aggregate stores only `appearances` + count + `$name`. The frontend reads the aggregate plus the comp meta for each appearance (already cached by `fetchCompetitionMeta`), sorts by comp date desc, and resolves display image/bio/location to the latest non-null. KISS — moves complexity out of the trigger.

### 9. Aggregate `$name` denorm: sample from first appearance

The trigger sets aggregate `$name` to the first appearance's name (RTDB key order is deterministic on compId:staffId). Used as the public-facing aggregate name and the source for the `judges:index` key. Imperfect — admin can refine if needed.

### 10. Race tolerance over locking

Concurrent writes for the same name may create duplicate aggregates. Last writer's `judges:index` entry wins; the orphan has zero appearances and is harmless. Admin merge tooling (later) can clean these up.

### 11. Public read on aggregates; admin/function-only write

Matches the existing `competitions` and `competitions:data` read pattern. Inheriting the env-level admin-only write rule means writes only happen via Cloud Functions (which run as service account).

### 12. Backfill: per-entity, admin-callable, idempotent

One `backfill{Entity}Aggregates` callable per kind. Wipes `/{entity}` and `/{entity}:index` then rebuilds from source. Re-runnable. Avoids accidental partial state from script crashes.

### 13. Dancer URL backwards compat: hard-cut

Existing slug URLs (`/dancers/sandra-weyman`) will 404 after the migration. Reason: small user base, deep links unlikely to be in the wild, redirect-shim complexity not worth it.

### 14. Phased rollout

1. **Phase 1 (done)** — Judges aggregate triggers + backfill + DB rules
2. **Phase 2** — Judge profile frontend (route, layout, composable). Search.vue navigates to profile (kills picker sheet for judges).
3. **Phase 3** — Pipers — abstract aggregator factory, apply to pipers
4. **Phase 4** — Venues — different source path (comp meta), name+locality identity
5. **Phase 5** — Dancers rearch — replace existing slug-based pages with ID-based, using aggregator
6. **Phase 6** — Cleanup — remove `CompetitionPickerSheet`, simplify `searchAll` mapping, retire legacy

### 15. Search integration approach

Phase 2 approach: keep Typesense per-comp indexes as-is. Frontend looks up `judges:index/{normalizedName}` to resolve a search hit to an aggregate ID, navigates to profile. Avoids re-indexing Typesense in Phase 2.

Later (post-MVP): switch Typesense to index the aggregate collections directly. One doc per entity, no name-grouping in `searchAll`.

### 16. Abstract aggregator factory introduced at Phase 3

Judges built without abstraction (Phase 1) since premature. Phase 3 introduces `createStaffAggregator(config)` to share judges/pipers logic. Dancers and venues (Phases 4-5) use the same factory with config swaps.

## Implementation notes

### Phase 1 — Judges aggregate backend
- `functions/src/judges.ts` — aggregate machinery alongside Typesense
- `functions/src/index.ts` — `backfillJudgeAggregates` callable
- `firebase.rules.json` — public read on `/judges` and `/judges:index`

### Phase 2 — Judge profile frontend
- New route `/judges/:judgeId`
- `web/src/composables/useJudgeProfile.ts`, `views/judge/{JudgeLayout,Info,Results}.vue`, `components/nav/JudgeBottomNav.vue`
- `web/src/lib/entityIndex.ts` — shared `lookupEntityId()` + cache for resolving search hit names to aggregate IDs
- `Search.vue` `handleJudgeTap` — look up `judges:index/{normalize(name)}` → navigate to profile; fall back to picker if missing

### Phase 3 — Pipers (factory introduced)
- `functions/src/utility/aggregateStaff.ts` extracted then **renamed to `aggregatePerCompRecord.ts`** in Phase 5 once dancers joined. Generic `createPerCompAggregator(db, config)` factory used by all three.
- `pipers.ts` mirrors `judges.ts`, just swaps namespace + predicate + back-pointer field
- Frontend: copy of judge route/layout/composable; renamed throughout

### Phase 4 — Venues (separate factory)
- `functions/src/venues.ts` — separate from the per-comp-record factory because:
  - source is `/competitions/{compId}` itself (not under `competitions:data`)
  - identity key combines `normalize(venue) + '|' + normalize(locality || 'none')` to avoid same-name-different-city merges
  - back-pointer `venueId` sits on the hot-path comp meta read (≈ 20 bytes)
- Wired into existing comp triggers in `index.ts` via composed handlers (Typesense + venue side-effect from one trigger function)
- Frontend: `/venues/:venueId` route, simpler header (no bio/image), Building icon

### Phase 5 — Dancers rearch (hard cut)
- Factory generalized: `aggregateStaff.ts` → `aggregatePerCompRecord.ts`, now parameterized on `sectionName` (`'staff'` vs `'dancers'`) and `paramKey` (`'staffId'` vs `'dancerId'`)
- `dancers.ts` extended to use the factory; existing Typesense `.create()` swapped to `.upsert()` for idempotency
- `useDancerProfile` rewritten — was slug-driven `searchDancers()` re-runs, now a single `/dancers/{id}` read
- `useRecentDancers` storage key bumped (`v2`) and shape changed `{ slug → id }`. Old entries silently invalidated.
- `Search.vue` and `Dancers.vue` (index page) navigation: name → `lookupEntityId('dancers', name)` → push. No fallback (per ADR §13).
- View-transition keying on dancer rows dropped — old keys were slug-based and didn't survive the cut. Layout-level transitions still work.

### Phase 6 — Cleanup
- `CompetitionPickerSheet` retained for judges/venues/pipers as a defensive fallback when `:index` lookup misses (e.g. aggregate not yet backfilled). Cheap, can be removed in a later sweep.
- `dancerSlug()` helpers removed from `Search.vue` and `Dancers.vue`.
- Old `aggregateStaff.ts` deleted (superseded by `aggregatePerCompRecord.ts`).

### Conventions
- **Trigger order**: per-comp write → Typesense upsert → aggregate maintenance → back-pointer write. Back-pointer write re-fires onUpdate, which no-ops via equality check on `record[backPointerField]`.
- **Empty-name guard**: `findOrCreateAggregate` returns `null` if normalized name is empty.
- **Appearance keying**: `{compId}:{recordId}` (composite). Firebase push keys are globally unique in practice but spec-wise scoped to their parent — the composite removes any doubt.

## Post-implementation correction (2026-05-17)

### Back-pointer writes removed from backfill

Initial backfill design wrote `record.{entity}Id` back onto each source per-comp record. In testing against the emulator, this caused an `INTERNAL_ERROR` once the source-record onUpdate trigger fired (one per write × thousands of records) and re-entered aggregate maintenance in a tight loop.

Fix: backfill no longer writes back-pointers. Live triggers populate them on the next legitimate edit. Reverse lookup remains correct via `/{namespace}:index` (the frontend's `lookupEntityId` already uses this path). Nothing currently reads the back-pointer, so the absence is invisible.

If a one-shot back-pointer fill is needed later, run it as a separate chunked admin function (or with triggers temporarily disabled).

### Aggregate `name` field, not `$name`

RTDB rejects `$` in keys. The Typesense convention `$name` was carried over by mistake; the aggregate record uses plain `name`. Typesense docs continue to use `$name` (allowed there).

## Open questions / deferred

- **Admin merge/split UI** — not in scope. Manual DB editing for now.
- **"Latest non-null" tie-breakers** — if two comps share a date, ordering is by RTDB key insertion order. Good enough.
- **Aggregate Typesense index** — deferred to post-MVP.
- **Venue geo proximity** in identity — using locality only; revisit if same-name-same-locality cases appear.
- **Cypress fixtures** — explicitly out of scope per user direction.
