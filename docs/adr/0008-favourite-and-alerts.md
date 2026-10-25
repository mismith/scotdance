# ADR-0008: Favourite and Alerts, instead of Follow

Status: Accepted (Murray, 2026-10-10)
Date: 2026-10-09

## Context

v4 says Follow for everything you can keep track of: dancers, competitions,
judges, pipers, venues and organisations. What each one does differs:

| Following a… | A shortcut | Alerts |
|---|---|---|
| **Dancer** | Their day on Home, in their colour; "Only my dancers" in Dancers and Results; first in Dancers | When they place; the morning they dance; the in-app banner |
| **Competition** | Home's Coming up; starred in lists; the calendar's count; a red map pin | When its dancer list goes up; the morning of |
| **Judge, piper, venue, organisation** | First on their index page; starred on a competition's staff | None |

None of it is following as people know it from social media, and
"following" a child reads wrong.

Murray (2026-10-10):

- Favouriting something signs you up for its alerts, so Alerts appears only
  once it's a favourite. That lets a dancer be a favourite without alerts.
- Competitions don't need favourites. Pinned competitions, which is what
  following a competition used to be, aren't needed any more: a competition
  just has alerts.
- Keep it simple.

## Decisions

### 1. Dancers: ★ Favourite, with alerts

- **Favourite** is the button: their day on Home in their colour, "Only my
  dancers", first in Dancers.
- **Favouriting turns their alerts on.** You get them when they place and
  the morning they dance.
- **The bell appears only once they're a favourite:** **Alerts**, or
  **Alerts off** once turned off. Turning alerts off keeps them a favourite;
  a teacher can favourite a class and turn alerts off for most of it.
- **Lists show the star.**

### 2. Competitions: 🔔 Alerts only

- **Alerts** is the only button. **Alerts on** gets you the dancer list
  going up, and the morning of.
- **Nothing is pinned.**
  - No star.
  - Home's Coming up shows your favourite dancers' competitions.
  - The calendar's dots just count competitions.
  - Map pins aren't red.
- **Lists say "Alerts on"** with the bell, so you can see which you've
  asked for.

### 3. Judges, pipers, venues, organisations: ★ Favourite

A shortcut: first on their index page, starred on a competition's staff.
An organisation gets the bell, the same way as a dancer, once "a new
competition is listed" exists (ADR 0005).

### 4. The first time, on a phone

ADR 0006's sheet still asks before the phone's own prompt, once per phone,
the first time something turns alerts on: "Know the moment Chloe places.
Alerts come as notifications. Allow them on this phone?" **Not now** leaves
alerts on for the in-app banner. Settings › Alerts can ask again.

### 5. Data: almost nothing moves

- **Favourites stay** at `users:favorites/{uid}/{type}/{id}`.
  - A competition's entry there now means "alerts on". The path keeps its
    name, so nobody loses anything and nothing needs migrating.
  - `dancers:followers` and `competitions:followers` (ADR 0006) are kept
    from it as now.
- **One new path: `users:alertsOff/{uid}/dancers/{id} = true`**, for a
  favourite dancer with alerts turned off. The rules allow only the user
  themselves.
  - The senders (`sendResultAlerts`, `morningSummaries`) and the in-app
    banner (`useLiveAlerts`) skip anyone whose favourite has alerts turned
    off.
  - Unfavouriting a dancer removes their entry here too.

## Consequences

- Copy changes in about 20 files under `web/src`:
  - `FavoriteButton` becomes Favourite, or Alerts on a competition.
  - `FollowButton` becomes Favourite with the bell.
  - Rows, Home, Settings and empty states.
  - Their unit and e2e tests, plus About, Policies, and the wording in ADRs
    0005 and 0006.
- Competitions stop being pinned:
  - Home's Coming up, the calendar's favourite dots, the red map pins and
    the competition pickers' "followed" lose their competition favourites.
  - Their code gets simpler.
- The store screenshots show "Following", so they'd be taken again. Doing
  this before the v4 store builds avoids a second set.

## Built (2026-10-25)

- The senders check `users:alertsOff` as they send, so `dancers:followers`
  still lists every favourite and no new function is needed. Deploy the
  rules and the alert functions (`notifyFollowersOnResult`,
  `sendResultAlerts`, `competitionPublishedChanged`,
  `sendLinkedPublishedAlerts`, `morningSummaries`, `sendMorningSummary`).
- A competition's sheet: "Know when the dancer list is up", with its two
  alerts as the preview.
- Favouriting signed out asks for sign-in as before; the sheet then waits
  for the next time something turns alerts on, so it never stacks on the
  sign-in (or the new account's roles) sheet.
- The Dancers page says "Alerts off" under a favourite with them off, so a
  teacher can see which.
