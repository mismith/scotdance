# ADR-0001: v4 architecture — Vue 3 consumer rewrite alongside Vue 2 admin

Status: Accepted
Date: 2026-04-29

## Context

The current app is Vue 2.7 + Vuetify 2 + Vuex + Vuexfire + Firebase 10 + Capacitor 6, ~15k LOC across consumer and admin surfaces. Vue 2.7 and Vuetify 2 are EOL. The stack is hostile to AI-assisted development (options API, Vuex indirection, Vuetify slot soup, no types).

We want to rewrite the **consumer-facing** surface in a modern stack while keeping the admin surface on Vue 2 indefinitely (until separately ported). Admin is the bulk of the complexity; consumer is read-mostly with a small write surface.

## Decisions

### 1. Phasing

1. **v3.x maintenance**: bump only deps that affect *both* apps (the native shell). Concretely: Capacitor 6 → 8 (via official `npx cap migrate` for 6→7 then 7→8) and `firebase-tools` 13 → 15. Do **not** touch web-app-only deps in the old app (Firebase 10, Handsontable, Vuetify 2, etc.) — those will retire with the old app. Do **not** touch Vue 2.7, Vuex, Vuexfire. Ship as v3.x.
2. **v4.0.0**: build new Vue 3 app in `web/` (scaffold already in place), no rename of existing `www/`. Old app stays in place at root. Big-bang release flips hosting routing and Capacitor `webDir`.
3. Both apps coexist in production: new at `/`, old at `/admin`.
4. Long-term: separately port admin to v4 stack and retire the old app.

### 2. v4 stack

- **Vue 3** (Composition API, SFC, `<script setup>`)
- **TypeScript** — non-negotiable. AI agents navigate TS dramatically better than JS, and `functions/` is already TS.
- **Vite** (already in use)
- **Tailwind v4**
- **shadcn-vue + reka-ui** for components
- **Pinia** for state (auth, current competition, prefs)
- **VueFire** for the spots that need realtime; plain `getDoc`/`get()` composables for read-once data (archival results, completed competitions, etc.)
- **Vue Router 4** in **history mode** (no more `#/`)
- **Vitest** for unit tests if/when needed

### 3. Data access pattern

Default to **read-once** via composables (`useCompetition(id)`, `useDancer(id)`, etc.) using RTDB `get()`. Use `onValue` realtime subscriptions only on screens where it actually matters: live results during an active competition, schedule view on competition day. Archival data (past competitions, historical results) is fetched once and cached. This addresses the cost concern without an SQL migration.

RTDB stays as the store. No Firestore migration in this phase. That's a separate decision later if cost/perf demands it.

### 4. Folder layout, hosting & routing

**Folder layout** (no rename of existing `www/`):
- Old (Vue 2) app: source stays in `src/`, build output stays in `www/` (no change to current setup).
- New (Vue 3) app: self-contained subproject in `web/` with its own `package.json`, `vite.config.ts`, `tsconfig.json`. Build output goes to `web/dist/` (Vite default — no override).
- Root `package.json` keeps wiring scripts that delegate to `web/` (e.g. `dev:web`, `build:web`).

**Hosting**:
- New app at `/` (everything that isn't `/admin/*`).
- Old app at `/admin/*`.
- Same origin → Firebase Auth state shared automatically via IndexedDB.
- Old app's Vue Router base path updated to `/admin`; asset paths reconfigured accordingly.
- `firebase.json` rewrites: `/admin/**` → `www/index.html`, fallback → `web/dist/index.html`.

### 5. URL migration (hash → history mode)

v4 uses real URLs. v3 hash links break. Accepted — deep linking isn't relied on in practice. No redirect shim needed.

### 6. Cache cutover

Confirmed: v3 has **no service worker** (no registration, no Workbox, no PWA plugin). One less cutover risk.

Remaining concern is plain HTTP caching:
- v4 ships with `Cache-Control: no-cache` on `index.html`, long-lived `immutable` cache on hashed assets.
- Configure in `firebase.json` hosting headers.

### 7. Capacitor strategy

Two separate Capacitor apps long-term. **Phase 1**: ship the consumer Vue 3 app as the iOS/Android binary. Admins access admin via web browser. Add a "Manage" or pencil-icon link in the consumer app that opens `/admin` in the system browser when an admin user is detected.

This sidesteps bundling two SPAs into the native shell and lets the consumer app ship to the App Store independently of the admin port.

At cutover, update `capacitor.config.json`: `webDir: "web/dist"` (currently `"www"`). Capacitor 8's framework detection uses `dist` for Vite projects, matching the new app's default output.

**Toolchain requirements introduced by the v3.x Capacitor 8 bump** (apply now, before v4):
- Node.js 22+
- Xcode 26.0+ for iOS builds (deployment target raised to iOS 15)
- Android Studio Otter 2025.2.1+ (minSdk 24, compileSdk 36, AGP 8.13, Gradle 8.14.3)

### 8. Consumer-side write surface for v4

Day-one v4 must support:
- Auth: register, login, logout (Firebase Auth — straight composable port)
- Profile: update profile, change email, delete account (writes to `users/<uid>`, `users:favorites/<uid>`, `users:permissions/<uid>`)
- Favorites: toggle favorite dancer, toggle favorite competition

**Pushed to admin (Vue 2)**: competition submission form and its associated file upload (logo). Submitters are organizers anyway — they'll be on the admin side once the competition exists, so it's reasonable for the submission flow to live there too. v4 has no file upload code on day one as a result.

Everything else on the consumer side is read-only.

### 9. Branch strategy

Build v4 directly on `develop`. The new `web/` folder doesn't conflict with old-app bug fixes (which touch `src/`, `www/`, root config). Hosting/routing config gates v4 from prod traffic until ready. **No long-lived `next` branch.**

## Open questions

- **Typesense client in Vue 3**: framework-agnostic, expected fine. Spike before relying on it.
- **Crisp chat widget**: drop-in, but reconfirm it works in the new app.
- **Analytics/tracking**: audit what's embedded in v3, port to v4.

## Cutover checklist (for v4.0.0 release day)

- [ ] `firebase.json` rewrites: `/admin/**` → `www/`, fallback → `web/dist/`
- [ ] Old (Vue 2) Vue Router base = `/admin`, asset paths updated
- [ ] `capacitor.config.json` `webDir` flipped from `www` to `web/dist`
- [ ] HTML `Cache-Control: no-cache`, hashed assets `immutable`
- [ ] iOS Capacitor app rebuilt with v4 consumer bundle
- [ ] Admin pencil-icon link in v4 consumer app opens system browser to `/admin`
- [ ] All v4 consumer write paths verified against prod RTDB rules

## Consequences

- ~15k LOC of the old Vue 2 app (root `src/`, builds to `www/`) lives on indefinitely; bug fixes get harder over time as Vue 2 ecosystem rots further. Acceptable cost since admin complexity makes a same-time port unrealistic.
- Two-codebase period means a class of bugs needs fixing twice (e.g. Firebase rule changes affecting both apps).
- v4 big-bang release means high-stakes cutover day. Mitigated by: small consumer write surface (auth + favorites only), no service worker to clean up, no native deep-link redirects required, and the ability to roll back hosting rewrites + Capacitor `webDir` in two config changes.
