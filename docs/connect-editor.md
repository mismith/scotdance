# Shared owner-profile dancer editor

Connect, Entries and Binder's parent signup/portal use one `web/src/portal/DancerEditor.vue`. Connect renders it directly. The other apps import `https://connect.scotdance.app/dancer-editor.js`, which opens `/dancer-editor.html` in a viewport-sized frame. The existing Connect dialog supplies the desktop card/mobile sheet and its one scrolling body.

## Ownership and saving

The form owns fields and validation; host adapters own persistence. `openDancerEditor({load, save, signal})` obtains only the current dancer, account defaults/revision and `otherDancers`. Messages carry the exact peer origin, window, protocol `scotdance:dancer-editor:v1` and a fresh instance UUID. There are no credentials in URLs or messages. Each save contains the selected dancer, revision, explicit defaults choices and a stable request ID; host adapters verify the account has not changed. The loader returns only the successful selected record/deletion result. Account details are separate future scope.

Entries' existing owner callables continue to derive their UID from Firebase authentication. Binder's `manageConnectDancer` accepts either its authenticated portal UID or a verified active signup session. A supplied signup credential must validate even alongside a staff login. Browser-supplied UIDs, family IDs, public links and staff permissions are never identity evidence. Connect's separate `/binder-owner/{load,save,delete}` routes trust only Binder's service identity. The old `/binder/load` remains read-only for deployed-client compatibility.

The widget never authenticates with Connect's cookie. Existing central ScotDance sign-in and audience-specific host passes stay unchanged, including new-account creation. A `.scotdance.site` embed therefore does not need third-party Connect cookies or storage access permission.

Save updates the parent's private profile. Send signup submits only whitelisted contact/dancer fields to the named studio. Teacher management retains Binder's own UI, database and authorization. Later edits on either side do not change the other side. Removing a signup checkbox does not delete its Connect profile. Public-link `null` persists as an explicit unlink.

## Local review

Use Node 24 and install dependencies in `web`, Entries, Binder and their functions. No production data is used.

- Connect: `CONNECT_POLLING=true npm --prefix web run dev:connect -- --port 5320` (polling helps when the separate Vite root misses edits outside its root).
- Binder owner preview: `npm run dev -- --host 127.0.0.1 --port 5321 --strictPort` in its checkout.
- Binder site: `BINDER_PREVIEW_ORIGIN=http://127.0.0.1:5321 VITE_CONNECT_EDITOR_ORIGIN=http://127.0.0.1:5320 npm run dev:site -- --host 127.0.0.1 --port 5322 --strictPort`.
- Open `http://127.0.0.1:5322/signup?studio=cshd`, or the parent's account menu at `http://127.0.0.1:5322/?studio=cshd` → Your saved dancers.
- Entries browser harness: `VITE_FIREBASE_PROJECT_ID= VITE_CONNECT_EDITOR_ORIGIN=http://127.0.0.1:5320 npm run dev -- --mode editor-preview --host 127.0.0.1 --port 5323`. The harness is outside production build inputs. Its API is injected by the browser test, never by application code.
- With those servers running: `node scripts/test-shared-editor.mjs` and `node scripts/test-shared-editor.mjs --webkit` in this checkout.

Build `npm --prefix web run build:connect`; test `npm --prefix web test -- src/portal/__tests__`. Companion repositories also have type/build and owner authorization tests. Connect API's emulator integration exercises actual owner transactions, idempotency, stale writes, service routes and explicit unlinking; Google service identity verification is replaced only in the test process.

## Release order

Nothing is deployed by this work. Review the local form first. Deploy Connect API (new owner routes and null-link preservation), then Connect Hosting (editor and public JS with CORS), then Binder's `manageConnectDancer`, then Entries/Binder clients. The new Binder callable is private at IAM and enforces application authorization. Browser invocation must be enabled for that specific service using the established organisation-policy-compatible approach when deployment is authorized; do not broaden any other service. Existing Connect account routes retain `frame-ancestors 'none'`; only `/dancer-editor.html` permits the named first-party app origins and studio sites, with exact-origin/window checks in the widget.

Connect frontend lives on the ScotDance `next` lineage, not legacy `main`. No migration, production fixture, new password store, public-profile identity matching or automatic studio synchronization is part of this change.

## Local verification completed

- Connect frontend build and 11 portal tests; Connect API build and 13 tests.
- Entries production build/type check, 38 frontend tests and 301 function tests.
- Binder app/site builds/type check, 344 frontend tests and 285 function tests.
- Actual Connect API against isolated Auth/Firestore emulators: owner isolation, first/only defaults, explicit multi-dancer defaults, retries, stale revisions, Binder owner save/delete, old read-only route rejection and persistent public-profile unlinking.
- Binder Firestore integration: authentic signup session overrides a concurrent staff login; expired/closed sessions reject owner editing; submitted snapshots stay whitelisted and acceptance stays idempotent.
- Chromium and WebKit browser flows pass for signup, parent portal, native Connect and the real Entries wrapper. Browser API providers are fictional; production sign-in/storage behavior was not retested or deployed. Checks include cancellation, private saves, selected submission copies, birthday typing, city search, mobile picker bounds/Escape, focus return, deletion, retry receipts and account-switch cancellation.
- Hosting header matching keeps ordinary Connect routes unframeable; only the dedicated editor permits first-party embedding. Public loader CORS does not apply to private APIs.

The emulator test script completed successfully. The local Firebase CLI subsequently printed an update-cache permission error during shutdown; this did not fail any API assertion. No production service was contacted for the data tests.

## Opening and ownership copy

The loader prepares its full-size iframe invisibly and opens the modal only after the form/data/fonts are ready. There is no intermediate “Opening” screen, backdrop, focus change or scroll lock. Escape can cancel a pending open; late readiness cannot reopen it. Failed/expired loads still return the normal host error. `test-editor-opening.mjs` holds the real iframe request to verify this in Chromium and WebKit.

The clicked button shows a spinner after 200ms if opening is still pending, without changing its size or accessible name. Readiness, cancellation and errors clear it. Reduced-motion preferences are respected.

The editor and native app share `ConnectBrand.vue` for the existing icon and coloured wordmark. A yellow shield accompanies “Shared only when you consent.” at the bottom left of the form, beside Save. On narrow phones the text wraps while Save keeps its size. The signup page separately explains that selected details are shared on Send signup; editing a profile does not change an already-submitted studio copy.
