# ADR-0007: Weekends (linked competitions)

Status: Proposed
Date: 2026-10-09

## Context

Many weekends have a competition each day. They're separate competitions:
usually different names, often different venues and organisers, their own
registration numbers, dancers' numbers, trophies and results. But families
go to both, so the weekend is what they live through: on Saturday they want
tomorrow's dancing order, and on Sunday they want yesterday's results
(Murray, 2026-10-09). On ScotDance.app the two days are unrelated records:
Sunday's is found by searching for it, and the two can sit apart in the
competitions list with others between them.

This is not:

- **One competition over several days.** That already works: one record,
  one set of results, its days from the schedule ("Day 1 of 2",
  `lib/dancerDay.ts` `competitionSpan`). It stays as it is.
- **A series** (ADR 0005). A series is an organisation that competitions
  across a season belong to. A weekend is two or three days in a row that
  the same families go to.

## Decisions

### 1. Weekends are made, never guessed

Two competitions form a weekend because someone who runs them said so. The
app suggests (Manage, System admin › Tools) but never links on its own: two
unrelated competitions in the same city on the same weekend are common
enough that matching on date and place would mislead families
(Principle 3).

### 2. Data: each competition lists the others

```
/competitions/{id}/siblings/{otherId} = true
```

Every competition in a weekend lists every other one (the set is fully
connected), so any one of them knows the whole weekend without another
read. `links` was taken (links and files). The lists already read whole
competition records (`useCompetitions`), so every list, calendar, map and
profile gets the field for free, as organisations did.

Adding to a weekend writes both sides of every pair in one `write()` (one
atomic `update()`): adding C to A and B writes A↔C and B↔C. Taking one off
removes it from every other one the same way.

### 3. Who can add to a weekend (rules)

The organisations pattern (ADR 0005 §3), applied to both ends:

```
"siblings": { "$otherId": {
  ".write":    admin of $otherId,          // either end can take it off
  ".validate": "newData.val() === true
                && (admin of $competitionId && admin of $otherId || system admin)
                && competitions/$otherId/date exists"
}}
```

- **Adding** needs both: you manage every competition in the weekend, or
  you're a system admin. Otherwise someone could attach their competition to
  a popular one.
- **Taking off** needs either end (`.validate` doesn't run on a delete).
- If you don't manage one of them, the whole write is refused: "You don't
  manage Chinook Open. Ask its organisers to add it, or get in touch" (the
  help chat).

`competitionDeleted` also removes `competitions/{s}/siblings/{deleted}` for
each `s` in the deleted record, as `organisationDeleted` does for its links.

### 4. Who sees them

The other days show only where the viewer could see them: listed, or ones
they manage. A private Sunday never appears on a published Saturday. A
listed one that isn't published yet shows (its overview and staff are
public already).

### 5. Submit: "Add another day"

In Details, under the date: **Add another day**. Each day added (up to 4)
is a card with:

- Name: blank. The days' names usually differ.
- Date: the day after the one before.
- Registration number: blank, with a one-tap **Same as Saturday's** for
  when it's shared.

Organisations and contact are shared. In Venue, **Same venue for both
days** is on; turned off, each day gets its own venue picker. Review shows
each day, with Edit on each.

Beside the button, so the two aren't confused: "Each day is its own
competition. Families who come to both see them as one weekend. One
competition over two days? Give its first day: the schedule adds the rest."

**Storage.** One submission per day, written in one `write()`, each naming
the others:

```
/competitions:submissions/{id}/with/{otherSubmissionId} = true
```

The rules allow `with` only to a submission that exists once the write lands
(`newData`), so it's the same write in practice. `submittedBy` is stamped
afterwards by the function, so the person is checked at approval (below).

**Review and approval.** Each day is reviewed on its own, exactly as now; a
weekend's days don't trip `sameName`, which compares only the same date. In
`handleApproved`, the new competition is added to the weekend of every
`with` submission that already has a `competitionId`, both sides, through
the admin SDK, and only if both have the same `submittedBy`. Whichever day
is approved last makes the weekend, so a Saturday that's approved as it
arrives and a Sunday that needs a look still end up together. A rejected
day never joins.

**System admin › Submissions.** "Submitted with" lists the other days, each
linking to its submission. Selecting several to approve together works
already.

### 6. The weekend reads as one event

No switching between two places: wherever a family looks at time or at
their dancer, the weekend's other days carry on in place, each labelled by
its day and its own name. The competition you came in through stays the one
in the address and the app bar.

- **Home.** A dancer's card for today ends with **Tomorrow**: the other
  competition's name, the number they wear there, their first dance, time
  and place in the dancing order once the draw is up, and **Another venue**
  when it isn't the same one. On the second day the card starts with
  **Yesterday**: their placings, in one line.
- **A dancer's page** (in a competition) is their weekend: the day you came
  in through first, in full, with the number card for that day; then the
  other days, each with that day's number. Yesterday is a line of placings
  that opens that day's page; tomorrow is the dances with platform, time and
  dancing order. The same person is found through `dancerId` (`fetchEntries`).
  With no `dancerId`, only this day shows: never matched by name.
- **Schedule** runs on into the other days, with Today and Tomorrow as it
  already heads days. Where the competition changes, a card names it, says
  "Chloe is #27 there" for your dancers, and **Another venue** when the venue
  differs. Its events open in that competition.
- **Results**: this competition's first, then the weekend's others under
  their own heading ("Yesterday · Prairie Fall Classic", with "All 52 results
  posted"). Your dancers' age groups are marked as they are now, with their
  placings in the row.
- **Overview**: a **This weekend** card listing the other days (day, name,
  venue), each opening that competition.
- **Dancers** stays one competition's list, since numbers differ by day,
  with a **Sat 10 | Sun 11** switch in its header: the one place a switch
  is still needed.

Data (`composables/useWeekend.ts`): the other days' records come from the
list cache; their schedule, results, draws and dancers are fetched once
(`lib/competitionData.ts`), and watched live only on the day they're on.
Only weekends pay for this, and they're a handful a season.

### 7. Lists: one row for the weekend

A weekend is one row, with a range date tile (**OCT 10–11**, **Sat–Sun**),
each competition's name on its own line with its day, one location line
("Calgary, AB", or "Victoria and Saanich, BC"), and your dancers' dots or
the favourite star from any of its days. It opens the weekend at the day
that matters: today's, else the next, else the last.

- **Competitions list**: at the first day's place; under Today while any day
  is on.
- **Profiles** (venue, organisation, judge, piper), **Home's Coming up** and
  **Search**: the same row. Search's documents carry `siblings: string[]`
  (reindex once).
- **Calendar**: a bar across the weekend's cells.
- **Map**: a pin per venue, as now; a pin's callout lists the whole
  weekend.

One pure function, `groupWeekends(items)` (tested), gives every list its
weekends.

### 8. Manage

- **Manage › Details**: a **This weekend** section, just before
  Organisations. Its rows each have Take off (Undo). Two ways to add:
  - **Add a day** makes the next day's competition, set up like this one
    (§9).
  - **Add a competition** adds one that's already here. It opens the
    competition picker from Organisation Manage, with your own competitions
    within 3 days at the top.
- **System admin › Tools › Weekends**, for the competitions already here. It
  suggests competitions 1 to 3 days apart that share an organisation, a
  venue (`venueId`), or a town and the person who submitted them. A
  suggestion is strong when the organisation is the same and the days are
  consecutive. **Add them all** applies the strong ones, with Undo. It's a
  pure function, `lib/weekendSuggestions.ts`, like `organisationTagging.ts`.

### 9. Set up the weekend once

An organiser asked (2026-10-09) for a way to "duplicate competition so like
the competition venue and judges etc all copy over for multiple day
events". A one-off copy forks the two days, though: every correction after
it (a judge swapped, a venue typo, a new age group) has to be made twice,
and the days drift apart. What organisers mean is that most of a weekend is
the same, and it should be set up once.

**What organisers see.** In a weekend, Manage's Staff, Categories, Age
groups, Dances, Platforms and Dancers each list the whole weekend:

- Every item shows the days it's in as **day chips** (**Sat ✓ Sun ✓**).
  A change applies to every day it's in, with nothing to choose. Untick a
  day for what differs: a judge on Saturday only, an age group that runs
  on Sunday only.
- **Dancers** are one list, with a number for each day (the same number
  both days, or different), and **+** to enter a dancer on a day.
  **Import** takes one sheet for the weekend, with a number column for each
  day.
- **Details**: name, date and registration number are per day. Venue,
  address, organisations, links and the registration link are the
  weekend's, with **Different on Sunday** for when one isn't.
- **Schedule, dancing order and results** stay per day. Manage opens on
  today's day.
- **Add a day** (Manage › Details › This weekend) makes the next day's
  competition already set up like this one: every item ticked for it,
  dancers not entered. It asks only for the new day's name and date. There
  are no copy options, because nothing is copied that then has to be kept
  in step.

**How it works.** Each day stays a whole, ordinary competition, so
everything that reads one (the app, the v3 apps, search, the aggregators,
alerts) keeps working untouched. Instead of syncing copies in the
background, the weekend's Manage writes every day at once:

- Every Manage change already goes through one `commit()` in
  `useManagedCompetition` and one `write()`, a single atomic multi-path
  update. In a weekend, `commit()` repeats each path for every other day the
  item is in, in the same update. Undo puts back every day together.
- **Shared items have the same key on every day** (staff, categories, age
  groups, dances, platforms), so a path means the same item everywhere and
  nothing needs mapping: a group's `categoryId`, a dance's `groupIds` and
  the schedule's references hold on every day. Results and draws are keyed
  by the same age group and dance, so the families' side (§6) matches days
  exactly instead of by name. The keys can be shared because nothing
  indexes these on their own: staff search documents are keyed by
  competition and staff id (`staffDocId`), and appearances by
  `compId:recordId`.
- **Dancers are the exception.** The dancers search index is keyed by the
  entry id alone (`functions/src/dancers.ts`), so a dancer's entries get
  their own key on each day, tied by a `weekendKey` field shared across the
  days.
- **Rules need nothing new.** The write already checks every path. A change
  goes out to the days you manage; someone who manages only one day edits
  only that day (and the lists show where the days now differ). An invite
  from a weekend's Admins is for every day of it, so this stays rare.
- **When days differ anyway.** A co-admin of one day only, or a script, can
  still change one day. The weekend's lists compare a shared item's days
  and say **Different on Sunday: Morag Fraser's photo**, with **Make the
  same**. Nothing is overwritten without being shown.
- Pure functions, tested: `lib/admin/weekend.ts` merges the days' lists
  into one (an item and its days) and fans a change out into paths.

**Bringing in weekends made before this.** Two competitions set up
separately don't share keys. **Match up** (in This weekend) pairs their
staff, age groups, dances and platforms by name for the organiser to
confirm. It re-keys only a day with no results or draws yet; otherwise the
days stay as they are, and the families' side matches by name.

**Next year.** Making next year's competition from this one is a real
fork (nothing should stay in step), so it can be a plain copy later, with
new keys. It isn't part of weekends.

## Considered

- **A day switcher at the top of every page** (Sat 10 | Sun 11, keeping your
  place when you switch; mocked up 2026-10-08). Set aside 2026-10-09: it
  still treats the days as two places to flip between, when what families
  want (tomorrow's order, yesterday's results) can be right where they
  already are. It survives only on Dancers.
- **Joined rows in lists** (each day its own row, joined by a connector).
  One row says "one weekend" more plainly, and halves the rows.

## Not now

- **A page or name for the weekend itself.** The organisation's page is the
  umbrella when there is one.
- **Weekend aggregates**: trophies across days.
- **Live alerts across the weekend.** In-app alerts follow only the focus
  competition that's on today (`useLiveAlerts`), so Saturday's results
  posted on Sunday morning don't alert. That gap exists already; weekends
  make it more likely.

## Consequences

- Deploy: database rules (`siblings`, `with`), functions
  (`competitionSubmissionCreated`, `competitionSubmissionUpdated`,
  `competitionDeleted`, the competitions search schema), then System admin ›
  Tools › Competitions search once.
- Add a day is a write from the app: you manage both days, so the rules
  already allow it. The other admins are invited, as now.
- v3 ignores `siblings`, and its admin writes field by field, so it won't
  remove them.
- A weekend submitted together gets one approval email per day.

## Build order

1. Data, rules, Manage › Details' This weekend, deletion clean-up.
2. Add a day, and Manage across the weekend for Staff, categories, age
   groups, dances, platforms and details (§9). This is what organisers asked
   for, and shared keys make the families' side exact.
3. Home's Tomorrow and Yesterday, and a dancer's weekend.
4. Schedule and Results carrying on; Overview's This weekend; Dancers' switch.
5. Lists: `groupWeekends` in the list, profiles, Home, calendar, map, search.
6. Dancers with a number per day, and the weekend import.
7. Submit's Add another day; Tools › Weekends and Match up for weekends
   made before this.

## Open questions

- **Who can add**: both ends' admins (proposed), or one end asks and the
  other accepts (for two societies running Saturday and Sunday).
- **Results order**: the competition you came in through first (proposed),
  or always today's first.
- **Dancers**: keep its day switch, or is a dancer's weekend page enough.
- **Submit's Add another day**: still worth it, or is submitting the first
  day and adding the next in Manage enough. Add a day in Manage shares the
  setup from the start; two submissions don't.
- **Day chips by default**: a new judge goes on every day (proposed), or
  only the day you're on.
- **How many**: count likely weekends in the data before building Tools, to
  see whether suggestions or adding by hand will do.
