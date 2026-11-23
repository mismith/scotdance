# ADR-0020: On now, from people at the competition

Status: Built on `claude/on-now` (not merged, not deployed) (2026-11-23)
Date: 2026-11-23

## Context

On a competition day, people want to know which age group is dancing on each platform, so they can get ready
or wander back. Organisers won't update it all day, and the schedule's times are typed by hand and drift, so the
app has never guessed (Schedule shows only what's posted). Murray's call: ask the people who are there, with as
little effort and as little nagging as possible, and never make a guess look official.

What was true when this was written:

- v3 analytics (Sept 2025 to Nov 2026): a big championship has 100 to 190 people in the app an hour, an ordinary
  competition 10 to 25, so a few per platform per hour. Few open Schedule.
- 114 of 201 competitions with dancers or results had a schedule, 85 with platforms. A platform's running order
  is the age groups in order in each dance; the schedule has no time per dance.

## Decisions

### 1. A pink line, not a badge

- A thin pink line (pink means "now" in the app) across the top of the age group people say is on, on the event
  page only. It pulses gently. Its dot opens a pop-up: "People here say this is where things are right now. Last
  confirmed 4 min ago. Is that right?" with Yes, No and Not sure.
- No count of people is shown anywhere: a number invites gaming, and "1 person" kills trust.
- The line goes after 15 minutes without a Yes, or once results are in for its group or a later one.

### 2. One question, once, in one place

- A pink card just above the tab bar: "Is Novice 7 & 8 Years on now?" with the dance and platform under it, and
  Yes, No and Not sure (so nobody feels pushed into a guess). A bar drains for 8 seconds, then it folds away.
- It asks about the group after the line, or with no line, the first group after the last with results. Only on
  the competition's day, only signed in, only about the event on screen, for the platform in view.
- Once per question per device, and one question per visit to the page. After Yes it says "Novice 7 & 8 Years is
  on now" with Undo.

### 3. Signed-in answers only, one per platform

- `competitions:onNow:votes/{competitionId}/{platformId}/{uid} = { turn, vote, at }`: write-only for the account,
  at most every 5 seconds (Undo any time), only on a real platform, server time. Nobody reads them.
- A turn is `{dayId}/{blockId}/{eventId}/{scheduleDanceId}/{groupId}`. A new answer replaces the account's last.
- `onNowVoted` works out `competitions:onNow/{competitionId}/{platformId} = { turn, at }` (public) from the last
  15 minutes: the turn with more Yes than No whose latest Yes is newest. So the newest report wins, and one No
  takes back a single stray Yes. An organiser's answer counts three times.

### 4. Monitoring: a log, no page yet

- Every answer goes to `competitions:onNow:log/{day}/{competitionId}` (who, which platform, what, when), kept
  7 days; only system admins read it. `sweepOnNow` clears it daily, with answers and lines from before yesterday.
- A System admin page gets built only if something looks off.

## Left out (add back only if missed after a competition or two)

- Prompts on dancer pages, a line on the Schedule list, push alerts ("you're up soon"), "Several people say".
- Ordering in the tally (a backward move needing more people): one No already undoes a stray tap.
