# ADR-0007: Linked competitions

Status: Proposed
Date: 2026-10-10

## Context

Some competitions belong together:

- A **weekend**: a competition on Saturday and another on Sunday.
- A **week**: the annual SDCCS runs six or seven competitions on
  consecutive days.

Families go to several of them. Organisers set each one up, much of it the
same as the others.

They're still separate competitions. Murray (2026-10-10):

- Names, dancers, age groups and dances usually differ, and so does the
  venue, often.
- What's really the same is the **staff**, and sometimes the **venue**.
- Merging the days in families' screens would be too confusing.

So linking does two things:

1. **Families** can see which competitions are linked and jump between
   them. Each competition's pages stay its own.
2. **Organisers** pick one competition as the **primary**. The others can
   each choose to take its staff, its venue, or both. A function keeps those
   parts in step as the primary changes.

This is not:

- **One competition over several days.** That already works: one record,
  one set of results, its days from the schedule ("Day 1 of 2").
- **A series** (ADR 0005). A series is an organisation that competitions
  across a season belong to.

## Decisions

### 1. Links are made, never guessed

Competitions are linked because someone who runs them said so. Two
unrelated competitions in the same city on the same weekend are common
enough that matching on date and place would mislead families
(Principle 3).

### 2. Data

```
/competitionLinks/{linkId} = {
  primary: competitionId,
  competitions: { [competitionId]: true },     // every one linked, the primary too
}
/competitionLinks:of/{competitionId} = linkId           // which link a competition is in
/competitionLinks:sync/{competitionId}/{part} = true    // what it takes from the primary
```

- `part` is `staff` or `venue` to begin with (§3).
- A competition is in at most one link (Murray, 2026-10-10).
- `/competitionLinks` is public. It's read whole, as `/organisations` is
  (tens of links, not thousands), so lists and the switcher need no extra
  reads.
- Only functions write any of it, through the `linkCompetitions` callable
  (§5). The rules give the app no write access.

### 3. What can sync

| Part | What it covers |
|---|---|
| **Staff** | The whole staff list: judges, pipers, sponsors and the rest, with their photos and details. All of it or none: picking types would be too complicated (Murray, 2026-10-10) |
| **Venue** | `venue`, `address`, `location`, `lat`, `lng`, `country`, `region`, `locality` |

Each competition in the link switches each part on or off for itself.

- **Never synced:** the name, date and registration number; dancers; age
  groups, categories and dances; the schedule; dancing order; results.
- **Staff is the pool.** Who judges which platform each day stays in that
  competition's own schedule.
- **Later, if wanted:** organisations, links and files, platforms. Adding a
  part is a new name in `sync` plus its copy and its trigger; nothing else
  changes.

### 4. How it syncs (functions)

- **Turning a part on** copies the primary's into the competition, replacing
  what it had. Manage confirms first: "Sunday's 3 staff will be replaced by
  the 4 from SDCCS Pre-Premier Open". Sponsors on its age groups that pointed
  at a replaced staff member are re-pointed to the one with the same name,
  or cleared and listed in the confirmation.
- **Then triggers keep it in step.**
  - `competitionStaffSync` on `competitions:data/{id}/staff/{staffId}`.
  - The venue fields, in the existing `competitions/{id}` update trigger.
  - Each one checks whether `id` is a primary and, for every competition
    syncing that part, writes the primary's value. It reads the value fresh
    rather than taking the event's, so events that arrive out of order
    still end up in step.
- **Same keys.** A synced staff member has the same key in every competition,
  so sponsors and schedule judges can point at it. That's safe: staff search
  documents are keyed by competition and staff id (`staffDocId`), and
  appearances by `compId:recordId`.
- **No loops.** Only the primary's changes go out; copies don't sync onward.
  The aggregators run on each copy as on any competition, and write back
  the same `judgeId` / `piperId`.
- **The app can't change a synced part.** A `.validate` reads
  `competitionLinks:sync/{id}/{part}` and refuses writes from the app to the
  staff, or to the venue fields, of a competition that syncs them. A delete
  gets past `.validate`, but the app never offers one, and **Sync now** puts
  it back.
- **Turning a part off** keeps the competition's copy, editable again.
- **Changing the primary** re-copies every synced part from the new one,
  after a confirmation.
- **If the primary is deleted or taken out of the link,** the others stop
  syncing and keep what they have. Manage asks for a new primary.
- **Sync now** (Manage) re-copies a competition's synced parts, for anything
  that went astray.

### 5. Who can link (`linkCompetitions` callable)

One callable does it all: link, take out, make primary, and switch parts
on or off.

- **Changing a link** (linking, choosing the primary, switching a part)
  needs you to manage every competition it touches, or be a system admin.
  Otherwise someone could attach their competition to a popular one, or
  push their staff into it.
- **Taking your own competition out** needs only that competition.
- `competitionDeleted` takes a deleted competition out of its link.

### 6. Families: the switcher

**In a linked competition, its title is the switcher.** The title in the app
bar becomes a button with a chevron, with "4 of 7 linked" under it. It opens
the linked competitions: a dropdown on wide screens, a sheet on phones. Each
row shows:

- Its date tile and name.
- Today or Tomorrow when it is.
- **Another venue: …** when its venue differs from this one's.
- Your dancers' names, when they're dancing in it.
- A tick on the current one.

It lists names, not only days, because the names differ, and it fits seven
competitions as well as two.

**Picking one keeps your place:**

- A tab stays the same tab, with its query.
- A dancer's page goes to the same person (`dancerId`, via `fetchEntries`)
  if they're entered there. Otherwise it goes to that competition's
  Dancers.
- Anything deeper goes to that tab.

It navigates with `router.replace`, so Back still leaves the competition.

The title's tap-to-scroll-up stays on the status bar and on tapping the
current tab again.

**Also:**

- On Overview the app bar's title only appears once you scroll, so the
  header has the same switcher as a pill beside Favourite: **4 of 7 linked
  ▾**.
- Overview has a **Linked competitions** section with the same rows: the
  ones either side of this one, and **All 7**.
- Only competitions the viewer can see appear: listed, or ones they manage.
- Nothing else changes. Each competition's Dancers, Schedule and Results are
  its own.

### 7. Organisers: Manage › Details › Linked competitions

A section before Organisations.

- **On the primary:**
  - Its badge, **Primary**.
  - A switch per part, "Staff: synced to all 6", that turns the part on or
    off for every linked competition at once.
  - The linked competitions, each saying what it takes ("Staff · Venue",
    "Staff only: its own venue").
  - **Link a competition**: the competition picker from Organisation Manage,
    with your own competitions near these dates first.
- **On the others:**
  - "Takes from SDCCS Pre-Premier Open", with a switch per part.
  - **Make this the primary**.
  - **Sync now**.
  - **Take out of the link**.
- **Inline, too.** The switches live in this section, but a linked
  competition's Staff page offers the primary's staff where it's needed:
  "4 of 7 linked. SDCCS Pre-Premier Open is the primary", with **Take its
  staff**. That's the same switch, and it confirms what it replaces. Details'
  venue fields offer the primary's venue the same way.
- **Synced parts on the others are read-only.**
  - Staff shows "Synced from SDCCS Pre-Premier Open. Change staff there and
    it changes here too", with **Open it** and **Stop syncing**.
  - The venue fields in Details say the same.

For SDCCS: link all seven, make the first one the primary, and switch on
Staff and Venue for all. Any day at a different venue switches its own
Venue off.

### 8. The linked mark

Wherever a competition shows, a linked one says so, always in the same
way (Murray asked for one treatment across the app, 2026-10-10). Each
linked competition keeps its own row; nothing is merged.

- **Shape: a second tile behind the date tile.** The date tile already
  stands for a competition everywhere, so a linked one's tile has a second
  layer behind it, down and to the right, in a new `--stack` colour (a mid
  grey in both themes). It's one layer however many are linked. It works on
  a today tile too, which stays pink. It's a `linked` prop on `DateTile`,
  passed by `CompetitionDateRow` and the other rows.
- **Words: "4 of 7 linked".** The same phrase in a row's detail line, under
  the title switcher, and on Overview's pill. State is shape plus words here;
  colour stays free for today, live and favourites.
- **Where:** the competitions list; Home; Search; venue, judge, piper and
  organisation pages; a dancer's competitions; Manage's list. Also the title
  and Overview (§6).
- **Calendar:** a bar under a link's days joins them, beneath the tint the
  calendar already gives days with competitions.
- **Map:** a linked competition's pin label stacks the same way as its
  tile.
- **Not a chain icon.** The link icon already means a web link everywhere in
  the app (links and files, registration), and the copy and layers icons are
  taken too.

## Considered

- **Duplicate a competition** (2026-10-09). A copy goes its own way, and
  every later fix has to be made in both.
- **One weekend in families' screens** (2026-10-09): a dancer's whole
  weekend on one page, the schedule running on into tomorrow, results from
  both days together. Set aside 2026-10-10: the days are different enough
  that merging them would confuse.
- **Manage the weekend once** (2026-10-09): one list per section, with day
  chips on each item. Set aside with the above. Most of the setup differs
  from day to day, so it would mostly show differences.
- **Two-way sync**, where any linked competition's change goes to all of
  them. Two people changing two days at once would conflict, with no clear
  winner. A primary makes it plain where to change things.
- **A Sat | Sun toggle under the app bar** (Take 1). It doesn't fit seven
  competitions, and days alone don't say which competition is which.

## Not now

- More parts to sync (organisations, links and files, platforms).
- Submitting several days at once, linked on approval.
- Making next year's competition from this year's: a one-way copy, its own
  feature.
- Live alerts across linked competitions. In-app alerts follow only the
  competition that's on today, so Saturday's results posted on Sunday
  morning don't alert.

## Consequences

- Deploy:
  - Rules: `/competitionLinks*`, plus the `.validate`s on staff and on the
    venue fields.
  - Functions: `linkCompetitions`, `competitionStaffSync`, the venue part of
    the competition update trigger, and `competitionDeleted`.
- v3's admin can't change a synced part on a competition that syncs it: it
  gets permission denied. v3's admin goes at cutover.
- A synced judge appears on every linked competition in their profile,
  since they're on each one's staff.

## Build order

1. Links: data, the callable, Manage's Linked competitions (no sync yet).
2. The switcher, and Overview's Linked competitions.
3. Staff sync: the copy, the trigger, the rules, Staff read-only on the
   others.
4. Venue sync.

## Open questions

- **Words for a pair**: "1 of 2 linked" everywhere (proposed, the same
  wording everywhere), or "Linked with Chinook Open" when there are only two.
