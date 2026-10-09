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
  Organisations. Its rows each have Take off (Undo). **Add a competition**
  opens the competition picker from Organisation Manage, with your own
  competitions within 3 days at the top.
- **System admin › Tools › Weekends**, for the competitions already here. It
  suggests competitions 1 to 3 days apart that share an organisation, a
  venue (`venueId`), or a town and the person who submitted them. A
  suggestion is strong when the organisation is the same and the days are
  consecutive. **Add them all** applies the strong ones, with Undo. It's a
  pure function, `lib/weekendSuggestions.ts`, like `organisationTagging.ts`.

## Considered

- **A day switcher at the top of every page** (Sat 10 | Sun 11, keeping your
  place when you switch; mocked up 2026-10-08). Set aside 2026-10-09: it
  still treats the days as two places to flip between, when what families
  want (tomorrow's order, yesterday's results) can be right where they
  already are. It survives only on Dancers.
- **Joined rows in lists** (each day its own row, joined by a connector).
  One row says "one weekend" more plainly, and halves the rows.

## Not now

- **Copy setup from another day**: its age groups, dances, platforms, staff,
  and dancers with their numbers. This is the biggest time saver for
  organisers. It's its own design (what to copy, what to overwrite).
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
- v3 ignores `siblings`, and its admin writes field by field, so it won't
  remove them.
- A weekend submitted together gets one approval email per day.

## Build order

1. Data, rules, Manage › Details, deletion clean-up.
2. Home's Tomorrow and Yesterday, and a dancer's weekend.
3. Schedule and Results carrying on; Overview's This weekend; Dancers' switch.
4. Lists: `groupWeekends` in the list, profiles, Home, calendar, map, search.
5. Submit's Add another day, and approval.
6. Tools › Weekends for what's already here.

## Open questions

- **Who can add**: both ends' admins (proposed), or one end asks and the
  other accepts (for two societies running Saturday and Sunday).
- **Results order**: the competition you came in through first (proposed),
  or always today's first.
- **Dancers**: keep its day switch, or is a dancer's weekend page enough.
- **How many**: count likely weekends in the data before building Tools, to
  see whether suggestions or adding by hand will do.
