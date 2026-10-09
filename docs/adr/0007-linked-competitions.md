# ADR-0007: Linked competitions

Status: Proposed
Date: 2026-10-09

## Context

Many weekends have a competition each day: a Saturday and a Sunday run by
the same organisers, often at the same venue (not always), each with its own
registration number (sometimes shared), its own trophies and its own
results. Families go to both. On ScotDance.app they're two unrelated
records: Sunday's is found by searching for it, the two can sit apart in the
competitions list with others between them, and Submit's "Submit another"
keeps the venue, contact and organisations for the second one but doesn't
say they belong together.

This is not:

- **One competition over several days.** That already works: one record,
  one set of results, its days from the schedule ("Day 1 of 2",
  `lib/dancerDay.ts` `competitionSpan`). It stays as it is.
- **A series** (ADR 0005). A series is an organisation that competitions
  across a season belong to. Linked competitions are a handful of days
  that families move between, so they're worth switching between, not just
  listing.

What Murray asked for (2026-10-08): submit them together; find tomorrow's
from today's; group them in lists; a quick switcher to compare dancers,
results and schedules between them.

## Decisions

### 1. Links are made, never guessed

Two linked competitions are linked because someone who runs them said so.
The app suggests (Manage, System admin › Tools) but never links on its own:
two unrelated competitions in the same city on the same weekend are common
enough that matching on date and place would be wrong in the way that costs
families most (Principle 3).

### 2. Data: each competition lists the others

```
/competitions/{id}/siblings/{otherId} = true
```

Every competition in a linked set lists every other one (the set is fully
connected), so any one of them knows the whole set without another read.
`links` was taken (links and files). The lists already read whole
competition records (`useCompetitions`), so every list, calendar, map and
profile gets the field for free, as organisations did.

Linking writes both sides of every pair in one `write()` (one atomic
`update()`): linking C to A and B writes A↔C and B↔C. Taking one off
removes it from every other member the same way.

### 3. Who can link (rules)

The organisations pattern (ADR 0005 §3), applied to both ends:

```
"siblings": { "$otherId": {
  ".write":    admin of $otherId,          // either end can take a link off
  ".validate": "newData.val() === true
                && (admin of $competitionId && admin of $otherId || system admin)
                && competitions/$otherId/date exists"
}}
```

- **Adding** needs both: you manage every competition in the set, or you're
  a system admin. Otherwise someone could attach their competition to a
  popular one's switcher.
- **Taking off** needs either end (`.validate` doesn't run on a delete).
- If you don't manage one of them, the whole write is refused: "You don't
  manage Sunday's competition. Ask its organisers to link them, or get in
  touch" (the help chat).

`competitionDeleted` also removes `competitions/{s}/siblings/{deleted}` for
each `s` in the deleted record, as `organisationDeleted` does for its links.

### 4. Who sees them

A sibling shows only where its viewer could see it: listed, or one they
manage. A private Sunday never appears on a published Saturday. A listed one
that isn't published yet shows (its overview and staff are public already).

### 5. Submit: "Add another day"

In Details, under the date: **Add another day** ("Each day its own
competition, with its own results"). Each day added (up to 4) is a card
with:

- Name: the first day's, to edit.
- Date: the day after the one before.
- Registration number: blank, since each day often has its own, with a
  one-tap **Same as Saturday's** for when it doesn't.

Organisations, contact, description and links are shared. In Venue, **Same
venue for every day** is on; turned off, each day gets its own venue picker.
Review shows each day, with Edit on each.

Beside the button, so the two aren't confused: "One competition over two
days? Give its first day: the schedule adds the rest."

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
`handleApproved`, the new competition is linked to every `with` submission
that already has a `competitionId`, both sides, through the admin SDK, and
only if both have the same `submittedBy`. Whichever day is approved last
makes the link, so a Saturday that's approved as it arrives and a Sunday that
needs a look still end up linked. A rejected day never links.

**System admin › Submissions.** "Submitted with" lists the other days, each
linking to its submission. Selecting several to approve together works
already.

### 6. The switcher

A day switcher on every page of a linked competition: under the app bar,
above the page, in `CompetitionLayout` (outside the keyed `RouterView`, so
it stays put while the page beneath changes).

- A `Segmented`, one segment per competition in date order, labelled by
  day: **Sat 10**, **Sun 11**. When two share a date, by the part of their
  names that differs. The one that's on today has the live dot. More than 4: a
  `MenuPill` instead.
- Only when the set has 2 or more competitions the viewer can see. Every
  other competition looks exactly as it does now.
- **Switching keeps your place** (`lib/siblingRoute.ts`, a pure function,
  tested):

  | On | Goes to |
  |---|---|
  | Overview, Dancers, Schedule, Results | the same tab, same query |
  | A dancer | the same person (`dancerId`, via `fetchEntries`); if they aren't entered that day, Dancers, with "Chloe isn't dancing on Sunday" |
  | An age group | the one with the same full name (normalised), then the same dance by name in the hash; else Results |
  | A schedule event | the same event name on that competition's schedule; else Schedule |

- `router.replace`, so Back still leaves the competition, and the exit
  stays wherever you came in from (`trackCompetitionEntry` keeps the entry
  across a sibling switch). The page slides toward the chosen day
  (`data-nav-axis="x"`).

### 7. Finding tomorrow's

- **Overview**: an **Other days** section after the date and venue, one
  `CompetitionDateRow` per sibling. Its venue shows only when it differs.
  When a sibling falls on the same date, the section is called **Linked
  competitions** instead.
- **Follow**: right after following one, a one-tap **Also follow Sun 11**.
  Never followed for you.
- **A dancer's page**: an **Other days** line with the number they wear there
  and their placings, so the weekend reads at a glance.
- **Home**: the Tomorrow line already names Sunday's competition for
  followed dancers (`focus.daysAway === 1`). In Coming up, a linked set
  takes one slot.

### 8. Lists: together, not merged

A set stays together; it's never collapsed into one row. Each competition
keeps its own row, with its own date, follow state and tap target, but the
rows sit next to each other at the first one's place, joined in one card:

- No hairline between them, and a short connector between their date tiles.
- The venue line only once when they share it.
- Nothing from outside the set comes between them.

One pure function, `groupSiblings(items)` (tested), gives every list its
sets:

- **Competitions list.** The set sits in the section of its first member
  that isn't over: under Today while any of them is on, so Sunday sits under
  Saturday as "Tomorrow".
- **Profiles** (`ProfileCompetitions`: venue, organisation, judge, piper)
  and the **dancer profile**.
- **Home's Coming up.**
- **Search.** The Typesense document carries `siblings: string[]`, so hits
  group too. Reindex once.
- **Calendar.** A bar joins the set's day cells, as multi-day events do in
  calendar apps.
- **Map.** A pin's callout lists the whole set, with "Sun 11 · Saanich
  Arena" when the venue differs.

### 9. Manage

- **Manage › Details**: a **Linked competitions** section, just before
  Organisations. Its rows each have Take off (Undo). **Link a competition**
  opens the competition picker from Organisation Manage, with your own
  competitions within 3 days at the top.
- **System admin › Tools › Linked competitions**, for the competitions
  already here. It suggests sets of listed competitions 1 to 3 days apart
  that share an organisation, a venue (`venueId`), or a town and the person
  who submitted them. A suggestion is strong when the organisation is the
  same and the days are consecutive. **Link them all** applies the strong
  ones, with Undo. It's a pure function, `lib/siblingSuggestions.ts`, like
  `organisationTagging.ts`.

## Not now

- **Copy setup from a linked competition**: its age groups, dances,
  platforms, staff, and dancers with their numbers. This is the biggest time
  saver for organisers. It's its own design (what to copy, what to overwrite).
- **Side by side**: two days' results for one dancer or age group on one
  screen. The switcher (and the Other days line on a dancer's page) come
  first.
- **A page or name for the set itself.** The organisation's page is the
  umbrella.
- **Weekend aggregates**: trophies across days.
- **Live alerts across the set.** In-app alerts follow only the focus
  competition that's on today (`useLiveAlerts`), so Saturday's results
  posted on Sunday morning don't alert. That gap exists already; sets make it
  more likely.

## Consequences

- Deploy: database rules (`siblings`, `with`), functions
  (`competitionSubmissionCreated`, `competitionSubmissionUpdated`,
  `competitionDeleted`, the competitions search schema), then System admin ›
  Tools › Competitions search once.
- v3 ignores `siblings`, and its admin writes field by field, so it won't
  remove them.
- A weekend submitted together gets one approval email per day.

## Build order

1. Data, rules, Manage › Details linking, deletion clean-up.
2. The switcher and Overview's Other days, with the Follow offer.
3. Lists: `groupSiblings` in the list, profiles, Home, calendar, map, search.
4. Submit's Add another day, and approval linking.
5. Tools › Linked competitions for what's already here.

## Open questions

- **Who can link**: both ends' admins (proposed), or one end asks and the
  other accepts.
- **Switcher**: on every page (proposed), or only on Overview and the
  controls row of Dancers and Results.
- **Lists**: joined rows (proposed), or one row for the set.
- **Follow**: offered (proposed), or following one follows the set.
- **How many**: count likely sets in the data before building Tools, to see
  whether suggestions or hand-linking will do.
