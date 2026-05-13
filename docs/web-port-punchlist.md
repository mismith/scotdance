# Web App Port Punch List

User-facing features, polish, and solved-bug fixes from the OLD app (`src/`) that are missing or regressed in the NEW app (`web/`). Line refs are to OLD unless noted.

Admin-only gaps are intentionally omitted (e.g. status badges, tie-edit toggle, Handsontable, admin schemas).

---

## Critical — real user-visible feature gone

### Discovery & navigation
- [ ] **Keyword search on competitions list** — debounced field with clear button ([SearchField.vue](../src/components/SearchField.vue), [List.vue](../src/views/competitions/List.vue))
- [ ] **Submit-a-competition form** — full stepper with checklist, place picker, preview, success flow, "Submit Another" ([Submit.vue](../src/views/competitions/Submit.vue))
- [ ] **"Submit Competition" CTA on Home** ([Home.vue:10-15,59-64](../src/views/Home.vue))
- [ ] **"Now" temporal marker + jump-to-now FAB** with up/down chevron based on scroll position ([List.vue:61-112](../src/views/competitions/List.vue))
- [ ] **Scroll position restoration** via `v-persist-scroll` directive (every list + detail view) ([main.js:97-136](../src/main.js))
- [ ] **Route + tab restoration on app re-open** — last route + per-competition tab params persisted to localStorage ([main.js:151-199](../src/main.js))
- [ ] **`?at=elementId` scroll-to-anchor** via `$scrollAll` / Vue.ScrollTo ([main.js:66-79](../src/main.js))

### Search-dancers page
- [ ] **Group results by competition** with date + location subtitle, collapsible per comp ([Dancers.vue:41-71](../src/views/Dancers.vue))
- [ ] **Group results by surname initial** (Typesense `group_key[0]`) ([Dancers.vue:42-46](../src/views/Dancers.vue))
- [ ] **"Favourite All" button** to bulk-favourite an entire result set ([Dancers.vue:35-39,189-191,351-355](../src/views/Dancers.vue))
- [ ] **"Report a Mismatch" → Crisp chat** with prefilled link to bad dancer ([Dancers.vue:72-84,361-370](../src/views/Dancers.vue))
- [ ] **`$scrollTo()` smooth scroll** when picking a search result ([Dancers.vue:268-272](../src/views/Dancers.vue))

### Results / placings polish
- [ ] **`MarkerChip` badges** — visible "Today", placing chips ([MarkerChip.vue](../src/components/MarkerChip.vue), [CompetitionTimelineItem.vue:21](../src/components/CompetitionTimelineItem.vue))
- [ ] **Tie marker chips (T1/T2/Joint)** — logic preserved (`tied: true`) but chip UI gone; users see two "1st" rows with no explanation ([PlacedDancerList.vue:22-36](../src/components/PlacedDancerList.vue))
- [ ] **`ResultsProgressIndicator`** — "X of Y events posted" tick/progress icons per category ([ResultsProgressIndicator.vue](../src/components/ResultsProgressIndicator.vue))
- [ ] **`EmptyResults` differentiation** — "No Dancers Placed" vs "No Callbacks" vs "TBD" (new shows generic "Not yet posted") ([EmptyResults.vue:7-12](../src/components/EmptyResults.vue))
- [ ] **Trophy sponsor line in Overall** — `{{ currentGroup.trophy }} Trophy Sponsor` ([Results.vue:131-143](../src/views/competition/Results.vue))
- [ ] **Auto-scroll-to-new-results toggle** in Results menu ([Results.vue:80-96,394-401](../src/views/competition/Results.vue))
- [x] **"All Dancers" pseudo-dance** showing full group roster ([Results.vue:319-322](../src/views/competition/Results.vue))
- [ ] **Category-level favorite star** — `mdiStar` next to category name if any group inside has favorites ([Results.vue:20-22](../src/views/competition/Results.vue))
- [x] **Placeholder dancer striped pattern** + HelpTip explaining placeholder dancers — solved differently: new app renders unmatched dancers as an explicit "Unknown dancer" row with dashed-border avatar ([Group.vue:316-328](../web/src/views/competition/Group.vue)), which is more legible than the old stripe. HelpTip explainer deferred to the HelpTip system port (line 44).
- [ ] **Pre-open accordion on group page** when arriving from a dancer dance link (new uses hash anchor only) ([DancerReportResults.vue:5-6](../src/components/DancerReportResults.vue))

### Cross-cutting
- [x] **PWA update prompt** with version diff + platform-aware store link (`itms-apps://` / `market://` / web reload) ([PromptToUpdate.vue:14-19,55-66](../src/components/PromptToUpdate.vue), [store.js:80-86](../src/store.js))
- [ ] **Crisp live chat integration** — feedback menu, mismatch reporting, support channel ([App.vue:207-220,432-434](../src/App.vue), [store.js:249-264](../src/store.js))
- [ ] **`RequiresAuthDialog`** — "Track your favourites", "Pin for easy access", "Submit your competition" with explanatory copy + AccountButtons ([RequiresAuthDialog.vue](../src/components/RequiresAuthDialog.vue), [App.vue:255-284](../src/App.vue))
- [ ] **Wire favorite/pin toggles into post-login queue** — `auth.ts` has the queue; `favorites.ts:toggleDancer`/`toggleCompetition` don't use it for unauth case ([store.js:212-247](../src/store.js))
- [ ] **`HelpTip` system** — context tooltips for `championship-points`, `placeholder-dancer`, `presets` ([HelpTip.vue](../src/components/HelpTip.vue))
- [x] **Settings page** — dark mode toggle + "Reset app cache" with explanation ([Settings.vue](../src/views/Settings.vue))
- [x] **Policies / Privacy / Terms page** — legally meaningful ([Policies.vue](../src/views/Policies.vue))
- [ ] **Feature flags** bound from Firebase `/featureFlags` + "viewed history" badges for new menu items ([store.js:98-104,121-136,266-268](../src/store.js))

---

## Stubbed / "coming soon" in new app
Risk shipping broken-looking pages.

- [ ] [web/src/views/Search.vue:161](../web/src/views/Search.vue) — "Search overlay — stub. Presets and examples are placeholders."
- [ ] [web/src/views/dancer/Results.vue:90,98](../web/src/views/dancer/Results.vue) — stats tiles all "—" with "coming soon", map view labeled "Map view — stub"

---

## Bug-fix regressions (solved-bug risks)

- [x] **Dancer number sorting** — ~~pad `$number` for lexical sort~~ new app sorts numerically, but `dancer.number` arrives from RTDB as a string and `Number.isFinite('2')` is false → all dancers collapsed to `Infinity`. Fixed by coercing `.number` to `number | undefined` in `loadDancers` ([useCompetition.ts](../web/src/composables/useCompetition.ts)).
- [x] **Group order pre-padding** — old's `String(10000 + i)` was a lexical-sort workaround using array index, not real persistence. New app sorts groups numerically via `byDragOrder` (see above), and schedule's `toOrderedArray` falls back to `id.localeCompare` when `.order` is missing — both behaviors equivalent to old for unordered data, correct for ordered data ([useCompetition.ts](../web/src/composables/useCompetition.ts), [schedule.ts](../web/src/lib/schedule.ts)).
- [x] **`hasPlaceholderDancers()` propagation** — added `isPlaceholderDancerId` + `groupHasPlaceholderDancers` helpers in [results.ts](../web/src/lib/results.ts); Results page now shows an amber AlertTriangle next to group rows with unmatched dancer IDs, with explanatory tooltip ([Results.vue](../web/src/views/competition/Results.vue)). Real data: 5 comps in dev export have placeholders (180 placements).
- [x] **`getFirstExisting()` route guard** — prevent crashes when deep-linking to a route the user lacks perms for ([router.js:46-54](../src/helpers/router.js))
- [ ] **`competitionExtender.$relevance`** — `Math.abs(now - date)` for "nearest to today" sort tiebreaker ([competition.js:31-39](../src/helpers/competition.js))
- [x] **`sortByUserDragOrder`** — new app already read `_order`, but used `?? 0` so unset items collided with explicit `_order = 0` at the front (real regression in 1 dances + 1 staff comp). Replaced with shared `byDragOrder` helper that sinks unset items to end (matches old `arr.length` fallback), tiebreak by push id. Applied to staff, categories, groups, dances, platforms ([useCompetition.ts](../web/src/composables/useCompetition.ts)).
- [ ] **Submission form `warningRules`** — client-side regex warnings for location format ("City, AB") and RSOBHD number format ([schemas/submissions.js](../src/schemas/submissions.js))
- [x] **`drawDialog` placeholder fallback** — bigger than the punchlist suggested: new app didn't load `draws` at all and DrawDialog was rendering group roster regardless of dance. Added `DrawsTree` type, fetched `draws` in `loadSchedule`, exposed via context. DrawDialog now reads `draws[group.id][dance.danceId]`, renders dancers in draw order, falls back to group-by-number when no draw exists, switches header label "Draw" ↔ "Order", and renders unmatched draw numbers as dashed-avatar "Unknown dancer" rows ([DrawDialog.vue](../web/src/components/DrawDialog.vue), [useCompetition.ts](../web/src/composables/useCompetition.ts), [Event.vue](../web/src/views/competition/Event.vue)). 6/16 dev comps have draws data.

---

## Smaller polish losses

- [x] **Sticky month headers** on the timeline (new month sections scroll off-screen)
- [ ] **`slugify(text)`** helper
- [ ] **`initialify(name)`** helper (3-char initials for avatars)
- [ ] **Generic fuzzy `searchByKeys()`** (Fuse, 0.33 threshold) — new only has dancer search
- [ ] **`mapRouteParams(['x','y'])`** factory for computed route params
- [ ] **`isExpanded/handleExpanded`** for persistent accordion state per item
- [ ] **Status-bar tap → scroll-to-top** on iOS native ([main.js:80-96](../src/main.js))
- [ ] **iOS/Android splash + `Device.getInfo()`** platform detection ([main.js:37-42](../src/main.js))
- [x] **Vuetify→Tailwind icon swap** — visual badges flatter; consider restoring color/contrast for placing chips

---

## Suggested porting order

1. Scroll persistence directive — single biggest UX regression, touches every list/detail view
2. Tie marker chip in `Place.vue` — logic already there, just needs the chip back
3. Competition search field — debounced keyword filter on list
4. Route/tab restoration on cold open — localStorage of last `RouteInfo.$current`
5. `?at=...` deep scroll — small util, unblocks share/deep links
6. Submit-competition form — bigger lift but it's a top-level CTA
7. PWA update prompt with version compare
8. Help/Crisp + Report Mismatch flow — bring back support channel
9. Settings + Policies pages — Policies is legally relevant
10. Trophy sponsor line, Results progress indicator, EmptyResults differentiation — small polish, big perceived quality
