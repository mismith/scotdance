# ADR-0002: Map view, date browsing, and location filter

Status: Accepted
Date: 2026-05-11

## Context

The v4 consumer app at [web/](web/) has a three-way toggle on `/competitions` (list / calendar / map) via [ViewModeTabs.vue](web/src/components/ViewModeTabs.vue). The map tab is currently a dashed-border placeholder ([CompetitionsList.vue:151-156](web/src/views/competitions/CompetitionsList.vue#L151-L156)). The list tab has a basic `upcoming | past | all` dropdown filter persisted in `useLocalStorage('competitions:filter')`.

We want to:
1. Make the map real — pins for every venue, color-coded by favorite status, tap → preview → tap-again → comp page.
2. Re-think date browsing so the default surfaces *currently relevant* comps without a filter chooser users have to interact with.
3. Add location-based filtering since the dataset is now worldwide (mostly Canada / UK / Australia / some US / South Africa).

The blocker: `Competition` in [web/src/types/competition.ts](web/src/types/competition.ts) only has free-text `venue` / `address` / `location` strings — no coordinates anywhere in the data. No coordinates → no pins. This drives Decision 1.

## Decisions

### 1. Geocoordinate storage — `lat` / `lng` directly on `Competition`

Add optional `lat?: number; lng?: number; country?: string` to the `Competition` interface. Coordinates get populated at admin-submit time (and at admin-edit time) by the existing Google Places integration in the old app, then carried alongside the existing free-text fields (which stay as a human-readable cache).

**Why on the comp, not in a separate venue catalog**: user-input venue strings drift (capitalization, "Glasgow RCH" vs "Glasgow Royal Concert Hall"), so a stable `venueId` would degrade over time. Coordinates are the only stable signal. We dedupe at render time by combining proximity (~50m) with normalized venue-name similarity: pins merge only if both within ~50m **and** their venue names match after lowercase / trim / strip punctuation / token-sort. Bias is toward false-split (mild duplication) over false-merge (your venue silently absent).

**Old admin app changes** ([src/views/competitions/Submit.vue](src/views/competitions/Submit.vue) → [src/helpers/maps.js](src/helpers/maps.js)):
- Add `'location'` to the `fields` array on `searchByText` (currently line 24). This is the new Places API's coordinate field (the legacy API used `'geometry'`; we are on the new `Place` class via `@googlemaps/js-api-loader`).
- In `getPlaceFields`, extract from `placeObject.location` — note that `Place.location` returns a `LatLng` instance, so use `.lat()` / `.lng()` method calls (or `.toJSON()` for `{lat, lng}` plain form). Verify the exact shape at implementation time with a `console.log(placeObject.location)` since the JS SDK has evolved its shape across versions.
- Extract `country` from the existing `addressComponents` loop in `getPlaceFields` (type: `'country'`), alongside the existing `locality` and `administrative_area_level_1` extraction.
- Persist `lat / lng / country` on the comp record alongside `venue / address / location`.

**Shared place-pick extraction**: the place-pick handler logic currently lives only in [Submit.vue:217-234](src/views/competitions/Submit.vue#L217-L234)'s `handlePlacePick`. The admin edit pane at [src/views/competition/admin/Info.vue](src/views/competition/admin/Info.vue) and submission review at [src/views/admin/Submissions.vue](src/views/admin/Submissions.vue) use the same `DynamicForm` + schema but do **not** call `getPlaceFields` — they treat the field-change generically. Without a fix, an admin re-picking a venue post-creation would silently skip the lat/lng/country extraction.

Move the extraction into a shared helper (`extractPlaceFields(placeObject)`) in `src/helpers/maps.js`, alongside `getPlaceFields`. Call it from `Submit.vue`, `Info.vue`, and `Submissions.vue` field-change handlers when the field type is `'place'`. Edit-once-fix-both.

**Backfill**: admin-gated callable Cloud Function (`functions/src/backfillCoords.ts`, exported as `backfillCoords` from `functions/src/index.ts`) that reads every existing record under the `competitions` path missing `lat / lng`, geocodes by its address string via the **Geocoding API** (`/maps/api/geocode/json?address=…` — different product from Places `searchByText`, cheaper at $5/1k), writes back. Triggered from the admin tools page (`src/views/admin/Dancers.vue`). Idempotent: skip rows that already have `lat / lng`. Accepts `{ dryRun: true }` to log proposed writes without persisting. Does not touch `competitions:submissions` — those flow through the live submit/edit handlers and get coords applied naturally.

**Why a callable function, not a local script**: the script approach required `GOOGLE_APPLICATION_CREDENTIALS` for Firebase Admin auth — a service-account key file on disk. Inside the functions runtime, the default service account is implicit and the Geocoding API key lives as a Cloud secret (`firebase functions:secrets:set GOOGLE_GEOCODING_API_KEY`). The admin can re-trigger the backfill any time without local credential setup.

### 2. Map library — MapLibre GL JS + OpenFreeMap

For v1: [MapLibre GL JS](https://maplibre.org/) as the in-browser renderer, [OpenFreeMap](https://openfreemap.org/) as the tile/data source. They are two separate things — Google bundles renderer + data into one product, OSS world splits them. The upside of the split is that the tile provider is swappable (MapTiler can drop in with one URL change) while the renderer code stays put.

**Why OSS over Google Maps**:
- Bundle is comparable (~200KB gzipped).
- Cost: free vs ~$7/1000 map loads after Google's $200/mo credit. Not crippling for current traffic, but adds up.
- OpenFreeMap has no rate limits and requires only attribution.
- Tile quality in 2026 is genuinely on par for non-POI use cases (we don't need restaurants, traffic, indoor maps, or Street View).
- Escape hatch: swap tile URL to MapTiler (100k free loads/month) or Stadia if OpenFreeMap availability disappoints. Renderer unchanged.

**Why not Leaflet**: Leaflet is more popular by download count, but DOM-based rendering doesn't scale as cleanly, and styling looks dated. MapLibre's WebGL vector tiles age better.

**Clustering**: [`supercluster`](https://github.com/mapbox/supercluster) (the same algorithm Mapbox uses) — handles the "Scotland zoomed out is a pile of overlapping pins" case.

**Attribution**: MapLibre's default attribution control stays enabled bottom-right; satisfies OSM / OpenFreeMap licensing requirements.

### 3. Date browsing — strict chronological agenda view, no filter dropdown

Replace the current `upcoming | past | all` dropdown with **one continuous chronological list**, anchored to today on first render. Mirrors Apple Calendar's Schedule view and Google Calendar's Agenda view.

**Layout**:
- Single time-ordered stream of comps.
- **Section headers per ISO week** ("Week of 18 May", "Week of 25 May", etc.) — gives a natural cadence aligned with how Highland comps actually run (weekends). **Weeks are Monday-Sunday regardless of locale** (matches the existing calendar view).
- **Empty weeks are skipped** — no section header rendered if zero comps fall in a week.
- **Week-vs-month grouping rule**: weeks render from the **start of the previous month** through the **end of two months ahead**. Everything outside that window groups by month. Example: today mid-May → weeks span Apr 1 to Jul 31; before/after, month sections.
- **Row-level chips** for human-friendly labels: "Today", "This weekend", "Next weekend", "Last weekend", "Tomorrow" — these are inline badges on the date stamp, not section dividers. The list stays in linear time order; the chips just make the *current* week's rows scannable.
- Initial scroll position: anchored to the first comp ≥ today (or to today's row if a comp is live).
- **Past comps**: visible above today, collapsed by default behind a "Show recent" / "Show earlier" expander. Tapping reveals the past 30d. Beyond that, the existing "Load archived" button stays.

**Why this is better than the bucket scheme I originally proposed**: my buckets (Today / This weekend / Last weekend / Next weekend / Coming up / Recently completed / …) jumped past↔future↔past, which is confusing even when the bucket *names* read sensibly. A linear stream + inline labels keeps the temporal order intact while preserving the recognizability of "this weekend".

**Locale**: date formatting in [web/src/lib/format.ts](web/src/lib/format.ts) passes `undefined` as the locale tag, so `Intl` falls back to the host (browser / Capacitor WebView) locale. The worldwide dataset means hardcoding any single locale is wrong — device locale is what the user expects.

**Status caveat**: this needs validation before locking in. Worth prototyping the agenda layout on the list view first (no map work needed), seeing how it feels, then committing. If the chronological-with-chips pattern doesn't land, fall back to a Resy/OpenTable-style chip row above a list ("Tonight / Tomorrow / This weekend / Custom") that filters the stream — chips become filters, not labels. Documenting that as the backup so we don't re-litigate.

**Calendar view**: opts out entirely — its month navigator is its date filter.

### 4. Location filter — nested country / region / locality

Reuse the structure already produced by [src/helpers/maps.js](src/helpers/maps.js) `getPlaceFields()`. Add `country` (from `addressComponents` type `country`) to that helper alongside the existing `locality` and `administrativeAreaLevel1` (region). Persist the structured tuple on the comp.

**Filter UI on the list and calendar views**: cascading dropdowns or a single hierarchical autocomplete — Country → Region → Locality. Each level's options derived from comps that exist in the dataset (no hardcoded country/region taxonomy — auto-grow). Plus a "Near me" chip that uses the browser geolocation API with a 300km radius (one-tap, no nested selection).

**Map view**: opts out of the location filter UI. The viewport *is* the location filter — pan/zoom navigates space.

**Defaults**:
- First-time visitor with geolocation permission granted: "Near me" auto-applied.
- Otherwise: no location filter (show all).
- Persisted to `useLocalStorage('competitions:location', …)`.
- **Zero-result fallback**: if auto-applied "Near me" yields zero comps in the visible window, fall back to no location filter and show a "No comps within 300km — showing all" banner. Prevents the dead-zone-user blank-screen first launch.

**Calendar respects the location filter**. The earlier proposal had calendar opting out; reversed because cross-tab incoherence (applying "Near me" then switching to calendar and seeing comps in Texas) breaks the user's mental model.

**Migration script** (same script as Decision 1's backfill): also extracts country/region/locality from existing comps' address strings during the geocode pass, writes structured fields back.

### 5. Map — viewport-driven, no location filter UI

Each non-list view replaces one filter UI axis with an intrinsic gesture:

| View | Spatial axis | Temporal axis |
|---|---|---|
| List | location filter (UI) | agenda window + Load archived |
| Calendar | location filter (UI) | month nav (intrinsic) |
| Map | **pan/zoom (intrinsic)** | date controls (UI) |

So the map:
- Has **no location filter UI** — pan/zoom does the spatial work.
- Respects the same default date window the list uses (the agenda's ±30d-ish range, with the broader week-grouping window for visibility).
- Keeps a **"Show all venues" toggle** that widens the date window to include archived comps — mirrors the list's "Load archived" semantics. This is the only filter control on the map.

**Pin colors**: blue by default, pink if any comp at that venue (post-dedup per Decision 1) is in the user's favorites set ([useFavoritesStore().isFavoriteCompetition](web/src/stores/favorites.ts) — reuse the same pattern the calendar already uses).

**Pin interaction**: tap pin → bottom sheet with venue name + chronological list of comps at that venue **within the active date window** (reuse [CompetitionRow.vue](web/src/components/CompetitionRow.vue)) → tap a row → `/competitions/:id`.

### 6. URL state for view tab and location filter

Persist `view` and the location filter to `?query` params via VueUse's `useRouteQuery`. Hydrate on load, write on change. Localstorage stays as the fallback for first-time visitors arriving without a URL.

Concretely: `/competitions?view=map`, `/competitions?view=list&country=GB&region=Scotland&locality=Glasgow`, `/competitions?view=list&near=1`. Shareability is non-optional for a worldwide dataset — half the value of the map view is being able to send "look at the Glasgow comps" links.

## Open questions

- **Date UX validation**: the agenda pattern (Decision 3) is the current best guess but not battle-tested for this dataset. Prototype on list before committing the section-rendering code.
- **Geocoding cost for the backfill script**: existing comp count × Geocoding API lookup cost ($5/1k). Probably trivial (single-digit dollars) but worth a head-count read before running.
- **"Near me" radius**: 300km feels right for Highland comps in Scotland; might be too small for Canadian/Australian users where 500-1000km between cities is normal. Probably make it a setting later.

## Files to touch

**Old app (Vue 2):**
- [src/helpers/maps.js](src/helpers/maps.js) — add `'location'` to Places `searchByText` fields; extract `lat / lng` from `placeObject.location` (verify `LatLng` shape — `.lat()/.lng()` methods vs `.latitude/.longitude` props depending on SDK version); extract `country` from the `addressComponents` loop; add shared `extractPlaceFields(placeObject)` helper.
- [src/views/competitions/Submit.vue](src/views/competitions/Submit.vue) — `handlePlacePick` calls `extractPlaceFields`; persist new fields on submit.
- [src/views/competition/admin/Info.vue](src/views/competition/admin/Info.vue) — field-change handler for `type: 'place'` calls `extractPlaceFields` so post-creation edits stay structured.
- [src/views/admin/Submissions.vue](src/views/admin/Submissions.vue) — same pattern for submission-review edits.
- `functions/src/backfillCoords.ts` — **new**. Admin-gated callable function. Geocoding-API call + write-back for existing `competitions` records missing `lat / lng`. Exported from `functions/src/index.ts` as `backfillCoords`, gated by `ensureAdmin`, reads the API key from a `GOOGLE_GEOCODING_API_KEY` secret defined in `functions/src/utility/config.ts`.
- [src/views/admin/Dancers.vue](src/views/admin/Dancers.vue) — add the trigger button (dry-run + live-run).

**New app (Vue 3, `web/`):**
- [web/src/types/competition.ts](web/src/types/competition.ts) — add `lat? / lng? / country?` to `Competition`.
- `web/src/lib/competitionFilters.ts` — **new**. Date label utilities (`weekLabelFor(date)`, `relativeChipFor(date)`), location-match predicate, venue-dedup predicate (proximity + normalized name).
- [web/src/lib/format.ts](web/src/lib/format.ts) — replace hardcoded `'en-US'` locale with `undefined` so all `Intl` formatters use the host locale.
- [web/src/composables/useCompetitions.ts](web/src/composables/useCompetitions.ts) — keep raw load; expose filtered stream + week/month-grouped output per Decision 3's rule.
- `web/src/composables/useLocationFilter.ts` — **new**. Persisted state (localStorage + URL via `useRouteQuery`) + geolocation helper + zero-result fallback.
- [web/src/views/competitions/CompetitionsList.vue](web/src/views/competitions/CompetitionsList.vue) — drop `Filter` dropdown, render agenda stream with week/month sections + row chips, add location filter UI.
- `web/src/views/competitions/CompetitionsMap.vue` — **new**. MapLibre shell, markers, clustering, bottom sheet, "Show all venues" toggle.
- `web/src/components/MapVenueSheet.vue` — **new**. Bottom sheet using [CompetitionRow.vue](web/src/components/CompetitionRow.vue).
- `web/src/lib/maplibre.ts` — **new**. Singleton map factory + tile source config.
- [web/src/components/CompetitionsCalendar.vue](web/src/components/CompetitionsCalendar.vue) — apply location filter (was: no change).
- [web/package.json](web/package.json) — add `maplibre-gl`, `supercluster`.

## Verification

- **Submit flow**: create a test competition in the old admin app, confirm `lat / lng / country` land on the RTDB record.
- **Edit flow**: edit an existing competition's venue via [Info.vue](src/views/competition/admin/Info.vue), confirm new fields update on the record (not just `venue / address / location`).
- **Backfill function**: trigger the dry-run button in `admin/Dancers.vue`, verify proposed writes in the response payload; live-run, confirm `lat / lng / country` land on the records; re-trigger live-run, confirm it's a no-op (idempotent).
- **Agenda list**: open `/competitions` on a Sunday, confirm yesterday's Saturday comp is still visible (above "Today" anchor) without expanding anything; opening on a Tuesday, confirm "Last weekend" chip is gone (past the Mon-Wed stickiness window) but the comp is still in the "Show recent" expander. Confirm empty weeks render no header.
- **Map**: switch to map tab → cluster view of the active dataset, tap a cluster → zooms, tap a pin → bottom sheet with comps at that venue, tap a row → navigate. Toggle "Show all venues" → archived venues appear.
- **Location filter**: enter "Glasgow" → list narrows to Glasgow comps; switch to calendar → calendar narrows too. Tap "Near me" → both views refilter based on browser geolocation. Simulate dead-zone user → confirm "No comps within 300km — showing all" banner appears and list shows everything.
- **URL state**: `/competitions?view=map` opens the map directly; `/competitions?country=GB&region=Scotland` opens list with the filter applied. Reload preserves both.
- **Capacitor iOS build**: pins render in the native iOS app build; bottom sheet sits above the native tab bar inset.
- **Empty states**: no comps match the active filter on map → overlay empty state instead of a blank map.
- **Manual testing only**: no unit-test infrastructure in `web/` as of v1.

## Consequences

- **Two-app touch**: this ADR edits `src/helpers/maps.js`, `src/views/competitions/Submit.vue`, and the admin edit/review panes in the old app. ADR-0001's rule is about old-app *deps* (Vuetify 2, Firebase 10, etc.), not code, so this is in-bounds.
- **No venue identity**: choosing lat/lng over a venue catalog means we can never cleanly do "all comps at this venue" without proximity-and-name clustering. That's a known trade-off; reconsider when/if venue-level features become a priority.
- **Default-no-filter agenda**: removing the filter dropdown is a UX bet. If it doesn't land, the fallback Resy/OpenTable chip pattern is documented under Decision 3. Plan to ship the agenda layout first as a no-op refactor of the list view (no map work) and validate before committing the rest.
- **MapLibre + OpenFreeMap risk**: if OpenFreeMap goes dark or quality regresses, we swap tile URLs and re-test. The renderer choice is the durable one; the tile provider is hot-swappable.
- **Worldwide dataset, no region hardcoding**: filter dropdowns derive from existing data, which means the experience degrades when filtering for under-represented countries. Acceptable for v1; revisit if the dataset grows unevenly.
- **Map filter asymmetry**: map drops the location filter UI and the calendar drops the date filter UI, in both cases because the view itself expresses that axis intrinsically (viewport / month nav). Cross-view filter state is asymmetric by design — switching from list → map preserves the date window but discards the location filter; switching list → calendar does the inverse. The location filter state survives across list ↔ calendar; the date window survives across list ↔ map.
