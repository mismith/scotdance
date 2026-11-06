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

### 1. Two tabs, signed in

- Signed in, a profile gets its own tab bar, like a competition's:
  **Overview, Results**. Results is always last.
- **Overview:** the header, four facts (level, competitions, seasons,
  dances) as tiles that open Results, the latest three competitions.
- A third tab, **Progress** (a wheel of the kinds of dance and a path
  through the seasons), is parked on its own branch until its design
  settles.
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
