# Web App Port Punch List

User-facing features, polish, and solved-bug fixes from the OLD app (`src/`) that are missing or regressed in the NEW app (`web/`). Line refs are to OLD unless noted.

Admin-only gaps are intentionally omitted (e.g. status badges, tie-edit toggle, Handsontable, admin schemas).

---

## Critical — real user-visible feature gone

### Discovery & navigation
- [ ] **Submit-a-competition form** — full stepper with checklist, place picker, preview, success flow, "Submit Another" ([Submit.vue](../src/views/competitions/Submit.vue))
- [ ] **"Submit Competition" CTA on Home** ([Home.vue:10-15,59-64](../src/views/Home.vue))
- [ ] **Scroll position restoration** via `v-persist-scroll` directive (every list + detail view) ([main.js:97-136](../src/main.js))
- [ ] **Route + tab restoration on app re-open** — last route + per-competition tab params persisted to localStorage ([main.js:151-199](../src/main.js))
- [ ] **`?at=elementId` scroll-to-anchor** via `$scrollAll` / Vue.ScrollTo ([main.js:66-79](../src/main.js))

### Search-dancers page
- [ ] **Group results by competition** with date + location subtitle, collapsible per comp ([Dancers.vue:41-71](../src/views/Dancers.vue))
- [ ] **Group results by surname initial** (Typesense `group_key[0]`) ([Dancers.vue:42-46](../src/views/Dancers.vue))
- [ ] **"Favourite All" button** to bulk-favourite an entire result set ([Dancers.vue:35-39,189-191,351-355](../src/views/Dancers.vue))
- [ ] **"Report a Mismatch" → Crisp chat** with prefilled link to bad dancer ([Dancers.vue:72-84,361-370](../src/views/Dancers.vue))

### Results / placings polish
- [ ] **`ResultsProgressIndicator`** — "X of Y events posted" tick/progress icons per category ([ResultsProgressIndicator.vue](../src/components/ResultsProgressIndicator.vue))
- [ ] **Trophy sponsor line in Overall** — `{{ currentGroup.trophy }} Trophy Sponsor` ([Results.vue:131-143](../src/views/competition/Results.vue))
- [ ] **Category-level favorite star** — `mdiStar` next to category name if any group inside has favorites ([Results.vue:20-22](../src/views/competition/Results.vue))

### Cross-cutting
- [ ] **Crisp live chat integration** — feedback menu, mismatch reporting, support channel ([App.vue:207-220,432-434](../src/App.vue), [store.js:249-264](../src/store.js))
- [ ] **`RequiresAuthDialog`** — "Track your favourites", "Pin for easy access", "Submit your competition" with explanatory copy + AccountButtons ([RequiresAuthDialog.vue](../src/components/RequiresAuthDialog.vue), [App.vue:255-284](../src/App.vue))
- [ ] **Wire favorite/pin toggles into post-login queue** — `auth.ts` has the queue; `favorites.ts:toggleDancer`/`toggleCompetition` don't use it for unauth case ([store.js:212-247](../src/store.js))
- [ ] **`HelpTip` system** — context tooltips for `championship-points`, `placeholder-dancer`, `presets` ([HelpTip.vue](../src/components/HelpTip.vue))
- [ ] **Feature flags** bound from Firebase `/featureFlags` + "viewed history" badges for new menu items ([store.js:98-104,121-136,266-268](../src/store.js))

---

## Stubbed / "coming soon" in new app
Risk shipping broken-looking pages.

- [ ] [web/src/views/Search.vue:161](../web/src/views/Search.vue) — "Search overlay — stub. Presets and examples are placeholders."
- [ ] [web/src/views/dancer/Results.vue:90,98](../web/src/views/dancer/Results.vue) — stats tiles all "—" with "coming soon", map view labeled "Map view — stub"

---

## Smaller polish losses

- [ ] **Generic fuzzy `searchByKeys()`** (Fuse, 0.33 threshold) — new only has dancer search
- [ ] **`mapRouteParams(['x','y'])`** factory for computed route params
- [ ] **`isExpanded/handleExpanded`** for persistent accordion state per item
- [ ] **Status-bar tap → scroll-to-top** on iOS native ([main.js:80-96](../src/main.js))
- [ ] **iOS/Android splash + `Device.getInfo()`** platform detection ([main.js:37-42](../src/main.js))
