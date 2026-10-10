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
"following" a child reads wrong. Murray (2026-10-10): the ones that give
alerts should say alerts, and the ones that are handy shortcuts can be
favourites.

A first version of this ADR (2026-10-09) made dancers Alerts and
everything else Favourite. But a dancer is both a shortcut and alerts, and
so is a competition, so one word for each can't say what it does.

## Decisions

### 1. Two things, each named for what it does

- **★ Favourite** keeps something handy. Anything can be one: dancers,
  competitions, judges, pipers, venues, organisations. The star stays,
  Royal Stewart red when on. The button says **Favourite** in both states,
  with the star filled when on (`aria-pressed`), as iOS does.
- **🔔 Alerts** tells you when something happens. Only what can alert you
  has it: dancers and competitions, and organisations once "a new
  competition is listed" exists (ADR 0005). The button says **Alerts**, then
  **Alerts on**.

A judge's page has Favourite only. A dancer's and a competition's have
both, side by side.

### 2. How they go together

- **Favouriting a dancer asks once**: "Know the moment Chloe places?" with
  **Get alerts** and **Not now**. This is ADR 0006's ask, which was already
  planned for the moment you start following someone. "Get alerts" leads to
  the phone's prompt.
- A teacher can favourite a whole class and say Not now: all of them on
  Home, none of them buzzing. That answers the open question of whether a
  dancer needed two switches.
- **Alerts on means Favourite on**: you can't get alerts for something that
  isn't on your Home. Turning Favourite off turns its alerts off too, and
  says so.
- **In lists, only the star.** The bell is on the dancer's or competition's
  own page, and in Settings › Alerts.
- **Settings › Alerts** lists what you get alerts for ("3 dancers, 2
  competitions"), above ADR 0006's kinds (results, morning of, dancer list
  up), which say what you get.

### 3. Data

- Favourites stay where they are: `users:favorites/{uid}/{type}/{id}`.
- Alerts are new: `users:alerts/{uid}/{dancers|competitions}/{id} = true`.
  The rules allow only the user themselves.
- The reverse indexes that send alerts (`dancers:followers`,
  `competitions:followers`, ADR 0006) are kept from `users:alerts` instead of
  `users:favorites`. The in-app banner (`useLiveAlerts`) reads the same set.
- **No one loses alerts they have.** A one-off backfill gives every
  existing dancer and competition favourite its alerts, as
  `backfillFollowers` did. It's in System admin › Tools.

## Consequences

- Copy changes in about 20 files under `web/src` (buttons, rows, Home,
  Settings, empty states), with their unit and e2e tests. Also About,
  Policies, and the wording in ADRs 0005 and 0006.
- Functions: the follower triggers move to `users:alerts`, plus the
  backfill.
- The store screenshots show "Following", so they'd be taken again. Doing
  this before the v4 store builds avoids a second set.

## Open questions

- **Favouriting a competition**: ask about its alerts as a dancer does, or
  turn them on quietly (as following a competition does now).
