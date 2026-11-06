# ADR-0016: A dancer's profile, and who sees it

Status: Accepted
Date: 2026-11-04 (revised 2026-11-06)

## Context

A dancer's profile was one page: their competitions a year at a time, with
the ribbons they won at each. Families asked to see a dancer's results over
time, and Murray wanted the profile to become a place to follow a dancer's
progress, like SportyHQ or Club Locker do for squash players.

Profiles are matched by name (ADR 0003), and most dancers competed for
years before ScotDance.app tracked them, so nothing can claim a career. And
dancers are mostly children, so a richer profile needs more care about who
looks at it.

## Decisions

### 1. One page, no progress stats

- A profile stays one page. Signed in, it lists every competition, a
  season at a time, newest first, with the placings at each.
- Overview and Results tabs, a Results **By dance** grid, and a Progress
  tab (a wheel of the kinds of dance and a path through the seasons with
  moments marked) were built and dropped. The code and screenshots are
  kept on the `claude/dancer-progress` branch.
- Why they were dropped:
  - Gathering a dancer's placings in one place makes a scoreboard, however
    kindly it's worded. Research on youth sport links settings that stress
    results and comparison with anxiety, burnout and quitting; settings
    that stress learning and enjoyment, with staying in. ScotDance.app
    should help raise well-rounded dancers who love the sport, not push
    them to win at all costs.
  - The data can't say much else. It starts in 2019, after most older
    dancers began; dancers learn every dance and dance whichever ones a
    competition runs, so "first time danced" isn't true; and nothing
    records effort, learning or enjoyment.
- A single placing stays on its competition, where the day gives it
  context. Nothing ranks a dancer against others or says how many were in
  an age group.
- Seasons run September to August and show as "2025–26".

### 2. Signed out, and hidden profiles

- Signed out, a profile shows its latest 3 competitions with placings, and
  a way to sign in to see the rest.
- A system admin can **hide** a profile when a family asks. That turns off
  the signed-in extra only: everyone sees the signed-out profile, and the
  dancer still shows in Search, Dancers and every competition's results.
  Kept at `dancers:hidden/{dancerId}` with who hid it, when and a note.
  Hidden profiles are listed under System admin › Directory.
- There's no claiming or verifying a profile: it was tried before and is
  too much by hand for one volunteer. A wrong match is fixed when reported.

### 3. Counting profile views

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

### 4. Read cost

- The profile reads each competition's placings for the dancer (a few small
  reads per entry, cached) all at once, on the phone. A function-kept
  summary per dancer is the next step only if long records feel slow.
