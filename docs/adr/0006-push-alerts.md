# ADR-0006: Push alerts

Status: Proposed (prototype on branch `claude/v4-orgs-push`)
Date: 2026-10-03
Supersedes: the parked `claude/front-row-push-alerts` (2026-09) and `feat/push-notifications` (2021–22).
Nothing is carried over from either: Murray asked (2026-10-03) for today's
best ways of doing it, so each choice below is the current Firebase, Apple
and Android one.

## Context

v4 already shows a banner the moment a followed dancer places, but only
while the app is open (`useLiveAlerts`). Parents want to know with the phone
in their pocket. The September branch built the server side; its app side
targeted screens that no longer exist, and it registered **APNs** tokens on
iPhone while sending through **FCM**, which rejects them (and its dead-token
cleanup would then delete them), so iPhones would never have received one.

## Decisions

### 1. What alerts there are

Each can be switched off; all start on.

| Kind | When | Example |
|---|---|---|
| Results | A placing is posted for a dancer you follow (or "results are in", when they didn't place) | **Chloe placed 2nd** · Highland Fling · Beginner Under 7 · Foothills Fall Classic 2026 (or **Sword Dance results are in**) |
| Morning of | 06:00–06:59 where the competition is, on its day | **Foothills Fall Classic 2026 is today** · Chloe is dancing. Tap for platforms and dancing order. |
| Dancer list is up | A competition you follow (or one a dancer you follow is in) is published | **Foothills Fall Classic 2026 is live** · The dancer list and schedule are up. |

Tapping one opens the result (`/competitions/{id}/results/{group}#dance-…`)
or the competition.

Titles carry the news and stay short enough for a lock screen; which dance,
age group and competition go on the line under (Murray, 2026-10-03).

### 2. Server (functions/src/notifications.ts)

- Reverse indexes `dancers:followers/{person}/{uid}` and
  `competitions:followers/{id}/{uid}`, kept by triggers on
  `users:favorites`; `backfillFollowers` (System admin › Tools) builds them
  once.
- **Results wait for a pause** (60 s; 5 s in the emulator) and then send what
  stands: Manage saves every tap, so someone placed 4th first would otherwise
  get "Results are in" and then "placed 4th" seconds apart. The wait is a
  **Cloud Task**: the database trigger checks someone follows a dancer in
  the age group, then queues the dance's results for `sendResultAlerts`
  (`onTaskDispatched`, retried up to 3 times) a minute on, which sends only
  if they still stand as saved (else a later save's task has it). Nothing
  sits open waiting: an earlier version slept in the trigger, which held up
  every other function in the emulator.
- Nothing until someone's placed; callbacks never; only around competition
  day (so entering old results doesn't notify).
- **Published** runs inside `competitionPublishedChanged`, after the publish
  sync that links entries to people (a separate trigger would race it and
  miss dancer followers). Not for competitions more than a day past.
- **Morning summary**: hourly job; each competition's time zone from its
  coordinates (`@photostructure/tz-lookup`, the maintained fork). Without
  coordinates, no summary (logged). Hourly beats a task per competition:
  dates change, and a scan of the next day's competitions is cheap.
- Dedupe in `notifications:sent/{key}` (a transaction), so re-saves and
  retries never send twice.
- FCM HTTP v1 (`sendEachForMulticast`): one multicast per person to all
  their phones. Tokens FCM says are gone are removed.
  - **Each kind interrupts as much as it should.** iOS interruption levels:
    a placing is **Time Sensitive** (it gets through Focus and the scheduled
    summary), the morning of is a normal alert, a dancer list going up is
    passive (no sound; waits in Notification Centre). Relevance scores rank
    them in the summary. Android: a channel per kind at the matching
    importance, so people can tune each in the phone's settings.
  - **A correction replaces what it corrects**: `apns-collapse-id` and the
    Android tag are a hash of what it's about (that dancer, that dance), so
    "placed 4th" then "placed 3rd" leaves one notification.
  - `thread-id` = the competition (iOS groups its alerts); icon
    `ic_stat_scott`, brand blue; an analytics label per kind for delivery
    numbers in the Firebase console.
- **Emulator**: nothing is sent; each alert goes to `notifications:log`,
  shown as notifications in System admin › Tools ("Sent here instead"), with
  a button to send a morning summary now.

### 3. App

- Tokens are **FCM tokens on both platforms**, from
  `@capacitor-firebase/messaging` (v8.5, Capacitor 8). Saved at
  `users:tokens/{uid}/{key}` (rules: self only) with when; re-saved each
  launch, as Firebase now advises, so none goes stale; removed on sign-out
  and account deletion.
- Which kinds: `users/{uid}/alerts` (`enabled`, `results`, `morning`,
  `published`), with the account, so every phone agrees. "Notifications" on
  or off is per phone (it's the token).
- **Asking**: iOS shows its prompt once. So the app asks first, in a sheet,
  the moment it means something: right after you follow a dancer ("Know the
  moment Chloe places"). "Not now" leaves the phone's prompt unused, for
  Settings later. Never on launch.
- **Settings › Alerts**: Notifications (this phone) with the three kinds
  under it once on; if the phone blocked them, how to turn them back on. The
  in-app banner stays as its own switch ("While the app is open"). On the
  web: the banner, and a note that the apps send notifications.
- While the app is open, the system banner is suppressed
  (`presentationOptions: []`) and the in-app banner shows instead, so
  nothing arrives twice.
- `?push` in an emulator build fakes a phone, to try the flow in a browser.

### 4. Not now

- **Live Activities** (iOS lock screen and Dynamic Island) for competition
  day: your dancer's platform, how many before them, then their placings, as
  they happen. The biggest step up from here: FCM can now start and update
  them (`liveActivityToken`, push-to-start on iOS 17.2+), but it needs a
  SwiftUI widget extension and a small native bridge. Android 16's Live
  Updates are its counterpart.
- Web push (needs a service worker, which the web app doesn't have, and a
  VAPID key; on iPhone it only works for home-screen web apps). The banner
  covers the web.
- Quiet hours, a per-competition mute, "follow an organisation" alerts.

## Native setup

Done on the branch: `@capacitor-firebase/messaging` 8.5.2 (it skips Firebase,
without crashing, when `GoogleService-Info.plist` is missing); AppDelegate
forwards the APNs token; `aps-environment` and Time Sensitive
(`com.apple.developer.usernotifications.time-sensitive`) entitlements;
`presentationOptions: []`; Android `google-services.json` moved to
`android/app/`, a channel per kind (made by the app), `ic_stat_scott` (drawn by `npm run brand`)
and brand-blue default icon colour in the manifest. The iOS app builds for the
simulator and launches without the plist.

Done (2026-10-04): the team's APNs key (team scoped, sandbox
and production, made for Firebase in 2018) is in Firebase for the iOS app;
`GoogleService-Info.plist` is in the App target; Push Notifications, Time
Sensitive Notifications and Background Modes › Remote notifications are on.

Left for Murray:

1. Deploy rules (`users:tokens`, the dancers `groupId` index), functions;
   run System admin › Tools › Alerts › Followers once.
2. TestFlight / internal testing on real phones: follow a dancer, enter a
   result in Manage, wait a minute.

## Consequences

- `morningSummaries` creates a Cloud Scheduler job (2nd gen `onSchedule`).
- `sendResultAlerts` creates a Cloud Tasks queue (deploy enables the API).
  Tasks are addressed to its 2nd gen URL, looked up from the Cloud Functions
  API (`utility/tasks.ts`), and only the functions' own account may invoke
  it.
- Functions now send to production phones from a shared backend: v3 phones
  never register, so they're unaffected.
