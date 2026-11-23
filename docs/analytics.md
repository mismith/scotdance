# Analytics

v4 sends page views to Firebase (Google) Analytics: property **ScotDance.app** (`160921130`, GA account `211282282`), the same property v3 uses. Code: `web/src/lib/analytics.ts`, started from `main.ts` in production builds only (never the emulators, tests or `vite dev`).

| Where | SDK | Stream | Event |
| --- | --- | --- | --- |
| Web | Firebase JS (gtag) | ScotDance.app web, `G-SFLYLX3P6L` (v3 too) | `page_view` |
| iOS app | native, `@capacitor-firebase/analytics` | ScotDance iOS | `screen_view` |
| Android app | native, `@capacitor-firebase/analytics` | ScotDance Android | `screen_view` |

## What's sent

One view per page (a change of path; a query change like typing a search isn't one):

| Web `page_view` | App `screen_view` | Example |
| --- | --- | --- |
| `page_title` | `screen_name` | `competition.schedule` (the route's name, **not** `document.title`) |
| `page_path`, `page_location` (origin + path) | `screen_class` | `/competitions/-Ok…/schedule` (**no query string**) |
| `competition_id` | `competition_id` | inside a competition only |
| `app_version`, `app_platform` | `app_version`, `app_platform` | `4.0.9`, `web` / `ios` / `android` |

So GA's built-in "Page title and screen name" and "Page path and screen class" read the same across web and apps. Also sent: the signed-in Firebase uid as GA's `user_id` (as v3 does). The web uses a random id kept in localStorage as GA's `client_id`.

Never sent: query strings (`?q=` holds what people type, often a dancer's name), page titles (dancer pages are titled with the dancer's name), any other personal data. On the web, `page_location`/`page_path`/`page_title` are also `set` globally so Google's own events (`session_start`, `user_engagement`) use them instead of the address bar.

No advertising IDs, so no consent prompt (as v3):
- iOS: the plugin's `AnalyticsWithoutAdIdSupport` trait (`capacitor.config.json` › `experimental.ios.spm`); the SDK logs "IDFA will not be accessible".
- Android: `AD_ID` and `ACCESS_ADSERVICES_*` permissions removed and `google_analytics_adid_collection_enabled` off in `AndroidManifest.xml`.
- Both: automatic screen reporting off (one Capacitor view would log one meaningless screen per launch).

## Why native in the apps

The apps' page is `capacitor://localhost` on iOS, where WebKit keeps no cookies. gtag.js loads and queues page views but never sends one (tested in the Simulator 2026-11-22). The native SDK sends, queues offline (useful at venues), and fills in app version and platform itself. Android's `https://localhost` page would likely have worked with gtag; it uses the native SDK too, for one model across both apps.

## GA settings (done 2026-11-22)

- Enhanced measurement **off** on the web stream. It sent extra `page_view`s on history changes using the real address bar, query string included (seen: `?q=<typed name>`), plus `scroll` events. That covers v3 too.
- Custom dimensions (event scope): `competition_id` "Competition ID", `app_version` "v4 version", `app_platform` "v4 platform", `page_path` "Path param" (v3's route, e.g. `/competitions/X/results`, and v4 web's). Not backfilled: they collect from 2026-11-22.

## Answering "active users per hour on competition X's day"

GA Explore › Free form: rows `Date + hour (YYYYMMDDHH)`, columns `v4 platform`, metric `Active users`, filter `Competition ID` exactly X and the day. Rows with `v4 version` `(not set)` are v3.

v3 differences: hash URLs (`#/competitions/…`), so its path is in its own `page_path` param ("Path param": for v3 competition X, filter it begins with `/competitions/X/`) and after the `#` in `page_location`, not in GA's Page path; and it sends `document.title` as `page_title`, which puts dancer names on dancer pages.
