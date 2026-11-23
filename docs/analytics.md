# Analytics

v4 sends page views to Firebase (Google) Analytics, property `firebase-scotdance`, web stream `G-SFLYLX3P6L`: the same stream v3 uses, so the two line up. Code: `web/src/lib/analytics.ts`, started from `main.ts` in production builds only (never the emulators, tests or `vite dev`).

## What's sent

One `page_view` per page (a change of path; a query change like typing a search isn't one), carrying:

| Param | Example | Notes |
| --- | --- | --- |
| `page_location` | `capacitor://localhost/competitions/-Ok…/schedule` | origin + path, **no query string** |
| `page_path` | `/competitions/-Ok…/schedule` | as v3 |
| `page_title` | `competition.schedule` | the route's name, **not** `document.title` |
| `competition_id` | `-OkFjjyEoM-wQMFrlzbs` | page views inside a competition only |
| `app_version` | `4.0.9` | every event |
| `app_platform` | `ios` / `android` / `web` | every event |

Plus the signed-in Firebase uid as GA's `user_id` (as v3 does), and a random device id kept in localStorage as GA's `client_id`.

Never sent: query strings (`?q=` holds what people type, often a dancer's name), page titles (dancer pages are titled with the dancer's name), any other personal data. `page_location`/`page_path`/`page_title` are also `set` globally so Google's own events (`session_start`, `user_engagement`, `scroll`) use them instead of the address bar.

No consent prompt: no ads, no advertising ID, same as v3 (the privacy policy lists it).

## The iOS app sends nothing yet

Tested in the iOS Simulator (2026-11-22): the app's page is `capacitor://localhost`, where WebKit keeps no cookies (`document.cookie` stays empty after a write). gtag.js loads and queues the page views, but never sends one: GA won't send without its cookie. The localStorage `client_id` doesn't change that.

The fix is the native SDK on iOS and Android (`@capacitor-firebase/analytics`, the same family and version as the messaging plugin): it sends to the property's iOS/Android streams, queues offline (useful at venues), and fills in app version and platform itself. Pending Murray's OK (it's a native dependency and a store build). The web keeps this web SDK.

Android's page is `https://localhost`, so the web SDK likely works there, untested.

## Before pushing (GA console, Murray)

1. **Turn Enhanced measurement off** for the web stream (Admin › Data streams › the web stream). It sends extra `page_view`s on every history change using the real address bar, query string included (seen in testing: `?q=<typed name>`), plus `scroll` and site-search events. It affects v3 too, which sends its own page views anyway.
2. **Register custom dimensions** (Admin › Custom definitions, event scope): `competition_id`, `app_version`, `app_platform`. Until then they're collected but not reportable in GA or the Data API. Registering doesn't backfill.

## Answering "active users per hour on competition X's day"

GA Explore › Free form: dimensions `Date + hour (YYYYMMDDHH)` and `App platform`; metric `Active users`; filter `competition_id` exactly X (or `Page path` begins with `/competitions/X/`) and the day. v4 rows have an `app_version`; v3 rows show `(not set)`.

v3 differences: hash URLs (`#/competitions/…`), so its path is in its own `page_path` param and after the `#` in `page_location` rather than GA's Page path; and it sends `document.title` as `page_title`, which includes dancer names on dancer pages.
