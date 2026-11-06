# ADR-0016: A dancer's progress, and who sees it

Status: Accepted
Date: 2026-11-04

## Context

A dancer's profile was one page: their competitions a year at a time, with
the ribbons they won at each. Families asked to see a dancer's results over
time, and Murray wanted the profile to become a place to follow a dancer's
progress, like SportyHQ or Club Locker do for squash players.

Two things shape it. Profiles are matched by name (ADR 0003), and most
dancers competed for years before ScotDance.app tracked them, so nothing
can claim a career. And dancers are mostly children, so a richer profile
needs more care about who looks at it. Two rounds of mockups settled the
shape.

## Decisions

### 1. Three tabs, signed in

- Signed in, a profile gets its own tab bar, like a competition's:
  **Overview, Progress, Results**. Results is always last.
- **Overview:** the header, four facts (level, competitions, dances,
  seasons), the latest three competitions.
- **Progress:** **Dances**, a wheel, then **How it’s gone**, a path.
  - The wheel splits into four fixed quarters with a thin X: Highland at
    the top, Character (Jig and Hornpipe) right, National at the bottom,
    Choreography left. An empty quarter says "not yet", which shows what
    a well-rounded dancer looks like.
  - A kind danced more fills more of its quarter, with its share under
    its name. Each dance reaches further out the better it goes, against
    the dancer's own best: its average share of the ribbons (1st = 1, 6th
    = 1/6, not placed 0), from three times danced. A fine twill marks the
    room to grow; double lines mark halfway and full.
  - Counted since moving up to the current level when that level has 20
    dances or more (placings drop on a step up), otherwise everything.
  - Tapping a quarter opens its dances across the whole wheel; tapping
    one gives its numbers. No tooltips.
  - The path wanders down the page, newest at the top, from where the
    dancer is now and the next competition count to reach, every season at
    once. It looks drawn in felt-tip and marked up in pen, like a printout
    someone was proud of; the words stay in the app's font. Each season is
    a milepost, a short tick across the road with its years underlined in
    pen (after Ogilby's 1675 strip road maps); quiet years are dashed. Its
    shape is seeded per dancer, a long gap travels further, and it deepens
    in colour with each level. The road draws itself down the page as it
    scrolls into view, once a visit, and each stop lands as the road
    reaches it (all at once with Reduce Motion).
  - Moments have three weights. Peaks (first competition, moving up a
    level, first trophy) get a big dot (gold for a trophy) circled in pen,
    and moving up is a double milepost. Every stop is a marker dot with
    words beside it: no icons, so no legend. Ordinary ones (first placing
    and first win at a level, championships, abroad, a dance that rarely
    placed then placed three times running, a kind of dance that improved
    most, placing in three kinds in one day) are solid dots, and counts
    show their number. Quiet ones (a best ever top three, one a season) are
    small hollow dots. Each opens the dancer's entry at that competition; a
    season's trend opens their results.
  - Trends were tested on the 2026 export first: better on Saturday or
    Sunday was noise and isn't shown. Nothing is about a drop, and the
    weakest dance is never named.
- **Results:** the full list, or **By dance**: a row per dance with every
  time they danced it, a season at a time. Overall comes last, as a trophy.
- Placings stay blue. A dancer's own placings and how they've improved are
  fine to show; nothing ranks them against other dancers or says how many
  were in an age group.

### 2. Only what ScotDance.app saw

- Every count says "on ScotDance.app" or "since 2019". No "first ever", no
  career totals.
- Seasons run September to August and show as "2025–26". A season
  with no competitions shows as a gap, never smoothed over.
- Moments are counts, firsts at each level and trends in what
  ScotDance.app saw. They stay true however much history is missing.
- Levels come from the category names organisers typed (Primary, Beginner,
  Novice, Intermediate, Premier). A category naming two levels, or none,
  is skipped rather than guessed.

### 3. Dances grouped on the screen only

- "FLING", "Fling (4)" and "Trophy Fling" all count as the Highland Fling,
  using the shared list of standard dances (`lib/standardDances.ts`) and,
  for the profile only, dropping words like Trophy, Special and
  Championship. Anything else stays its own row, as typed.
- What the organiser typed is never changed: each dance row lists its other
  spellings ("Also listed as…").

### 4. Signed out, and hidden profiles

- Signed out, a profile shows its latest 10 competitions with placings, and
  says what signing in adds. No tabs.
- A system admin can **hide** a profile when a family asks. That turns off
  the signed-in extras only: everyone sees the signed-out profile, and the
  dancer still shows in Search, Dancers and every competition's results.
  Kept at `dancers:hidden/{dancerId}` with who hid it, when and a note.
  Hidden profiles are listed under System admin › Directory.
- There's no claiming or verifying a profile: it was tried before and is
  too much by hand for one volunteer. A wrong match is fixed when reported.

### 5. Counting profile views

- Signed in, the app notes which profiles each account opened each day
  (`dancers:views/{uid}/{day}/{dancerId}`), kept 60 days. System admins
  aren't counted.
- An hourly function flags an account that opened more than 50 profiles in
  a day and emails the system admin. System admin › Review › Profile views
  lists flags and the accounts that opened the most profiles that week.
- 50 is a first guess: teachers open their whole class. Revisit it after
  two weeks of counts.
- This catches someone browsing lots of children's profiles in the app. It
  doesn't stop a script: results are public, and the profile data is read
  straight from the database. Sign-in is a gate in the app, not a lock on
  the data.

### 6. Read cost

- The profile reads each competition's placings for the dancer (a few small
  reads per entry, cached) all at once, on the phone. A function-kept
  summary per dancer is the next step only if long records feel slow.
