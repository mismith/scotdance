# ADR-0008: Favourite and Alerts, instead of Follow

Status: Proposed
Date: 2026-10-09

## Context

v4 says Follow for two different things.

- Following a **competition, judge, piper, venue or organisation** keeps it
  handy: on Home, starred in lists, the calendar and the map, and for a
  competition, an alert when its dancer list goes up.
- Following a **dancer** gets you alerts when they place and on the morning
  they dance, puts their day on Home in their colour, and drives "Only my
  dancers".

Neither is following as people know it from social media, and "following"
a child reads wrong. Murray (2026-10-09): it's more like favourite, or enable
alerts, respectively.

## Decisions

### 1. Competitions, judges, pipers, venues, organisations: Favourite

The star stays, Royal Stewart red when on. The button says **Favourite** in
both states, with the star filled when on (`aria-pressed`), as iOS does.
Rows say **★ Favourite**. It's the word v3 used, and the store is already
`favorites`.

### 2. Dancers: Alerts

A bell instead of the star.

- On a dancer's page: **Get alerts**, then **Alerts on**, which opens the
  menu with their colour and **Turn off alerts** ("Chloe comes off Home
  too").
- In long lists: the bell alone, filled when on.
- Home with none yet: "Get alerts for your dancers".
- "Only my dancers" stays: they're still your dancers.

The permission ask (ADR 0006 §3) now follows a button that names it: tap
Get alerts, then "Know the moment Chloe places", then the phone's prompt. On
the web, which has no notifications, alerts are the in-app banner, as now;
Settings › Alerts says so.

### 3. Words only

Data (`users:favorites`, `dancers:followers`), functions and rules don't
change. Component names can follow later (`FollowButton`, `FavoriteButton`).

## Consequences

- Copy in about 20 files under `web/src` (buttons, rows, Home, Settings,
  empty states), their unit and e2e tests, About and Policies, and the wording
  in ADRs 0005 and 0006.
- The store screenshots show "Following", so they'd be taken again. Doing
  the rename before the v4 store builds avoids a second set.

## Open questions

- One switch for a dancer (proposed), or two: on Home, and alerts. A teacher
  with 30 students might want them all on Home without 30 alerts; Settings ›
  Alerts' kinds and Home's compact mode cover that today.
