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

On 2026-10-11 he widened what's shared: everything on Details can sync too,
apart from what makes each competition itself (its name, date and
registration number).

So linking does two things:

1. **Families** can see which competitions are linked and jump between
   them. Each competition's pages stay its own.
2. **Organisers** pick one competition as the **primary**. The others take
   its staff and its details, each part switchable. A function keeps those
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

- `part` is one of §3's: `about`, `venue`, `registration`, `links`,
  `visibility`, `organisations` or `staff`.
- A competition is in at most one link (Murray, 2026-10-10).
- `/competitionLinks` is public. It's read whole, as `/organisations` is
  (tens of links, not thousands), so lists and the switcher need no extra
  reads.
- Only functions write any of it, through the `linkCompetitions` callable
  (§5). The rules give the app no write access.

### 3. What can sync

In Manage's order: Details' sections top to bottom, then Staff (Murray,
2026-10-11).

| Part | Switch | What it covers |
|---|---|---|
| `about` | **Description and logo** | `description`, `image` |
| `venue` | **Where** | `venue`, `address`, `location`, `lat`, `lng`, `country`, `region`, `locality` |
| `registration` | **Registration** | `registrationURL`, `registrationStart`, `registrationEnd` |
| `links` | **Links and files** | `links` |
| `visibility` | **Listed and published** | `listed`, `published` |
| `organisations` | **Organisations** | `organisations` |
| `staff` | **Staff** | The whole staff list: judges, pipers, helpers and sponsors, with their photos and details. All of it or none: picking types would be too complicated (Murray, 2026-10-10) |

- **All start on** when a competition is linked (Murray, 2026-10-11). Each
  competition switches each part off for itself, such as a day at another
  venue switching off Where.
- **Listed and published sync together**, so they can never disagree
  (Details already lists whatever it publishes). The switch says what they
  mean in families' terms, as Details does:
  - "Listed: families can find it in the competitions list."
  - "Published: they can also see its dancers, schedule and results."
- **Never synced:** the name, date and registration number (each day has its
  own); dancers; age groups, categories and dances; platforms; the schedule;
  dancing order; results.
- **Staff is the pool.** Who judges which platform each day stays in that
  competition's own schedule.
- **Later, if wanted:** platforms. Adding a part is a new name in `sync`
  plus its fields; nothing else changes.

### 4. How it syncs (functions)

- **Turning a part on** copies the primary's into the competition, replacing
  what it had. Manage confirms first: "Sunday's 3 staff will be replaced by
  the 4 from SDCCS Pre-Premier Open". Sponsors on its age groups that pointed
  at a replaced staff member are re-pointed to the one with the same name,
  or cleared and listed in the confirmation.
- **Then triggers keep it in step.**
  - `competitionStaffSync` on `competitions:data/{id}/staff/{staffId}`.
  - Every other part, in the existing `competitions/{id}` update trigger:
    it checks the changed fields against §3's table.
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
- **The app can't change a synced part.** A `.validate` on each part's
  fields reads `competitionLinks:sync/{id}/{part}` and refuses writes from
  the app to a part the competition syncs. A delete gets past `.validate`,
  but the app never offers one, and **Sync now** puts it back.
- **Publishing the set sends one alert** (Murray, 2026-10-11). Publishing
  the primary publishes every competition that syncs Listed and published.
  ADR 0006's "is live" alert would then come once per competition: 7 at once
  for a family with alerts on for the whole week. Instead each person gets
  one, for the ones they follow or have a dancer in: **7 competitions are
  live, Jul 5–11** · SDCCS Pre-Premier Open and 6 others: dancer lists and
  schedules are up. Tapping it opens the first of them.
  - Each copy's `competitionPublishedChanged` still links its entries to
    people first. Then, instead of alerting, it queues one task for the
    link a minute on, as results do (ADR 0006), and the task sends the
    alerts once every copy is in.
  - Someone with alerts on for just one of them gets the usual alert for it.
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
bar becomes a button with a chevron; the line under it stays as on any
competition ("Today · Halifax, NS"). It opens the competitions it goes with,
headed by what they are in plain words: **7 competitions, Jul 5–11**. That's
a dropdown on wide screens and a sheet on phones. Each row shows:

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
  header has the same switcher as a pill beside Alerts: **7 competitions
  ▾**.
- Overview has a section with the same rows, headed **7 competitions, Jul
  5–11**: the ones either side of this one, and **All 7**.
- **Words for families never say "linked"** (Murray found "4 of 7 linked"
  unclear, 2026-10-10). They say how many competitions and when. "Linked" is
  only for organisers, in Manage, where they link them.
- Only competitions the viewer can see appear: listed, or ones they manage.
- Nothing else changes. Each competition's Dancers, Schedule and Results are
  its own.

### 7. Organisers: Manage › Details › Linked competitions

A section before Organisations.

- **On the primary:**
  - **This one is the primary**, and under it: "The other 6 copy what's
    switched on below. Change it here and it changes in all of them."
  - **What they copy:** a switch per part, in §3's order, each saying what
    it covers ("The link, and when it opens and closes"). A switch turns
    the part on or off for every linked competition at once. One that some
    competitions have switched off says so: "Venue and address · Sunday has
    its own".
  - "Each keeps its own name, date and registration number."
  - **The other 6**, each saying what it takes: "Everything above", or "All
    but Where: its own venue".
  - **Link a competition**: the competition picker from Organisation Manage,
    with your own competitions near these dates first.
- **On the others:**
  - "Takes from SDCCS Pre-Premier Open", with a switch per part.
  - **Make this the primary**.
  - **Sync now**.
  - **Take out of the link**.
- **Inline, too.** The switches live in this section, but a linked
  competition's Staff page offers the primary's staff where it's needed:
  "Linked with 6 others. SDCCS Pre-Premier Open is the primary", with
  **Take its staff**. That's the same switch, and it confirms what it
  replaces. Where on Details offers the primary's venue the same way: "SDCCS
  Pre-Premier Open is at Halifax Convention Centre", with **Use its venue**.
- **Synced parts on the others are read-only.**
  - Staff shows "Synced from SDCCS Pre-Premier Open. Change staff there and
    it changes here too", with **Open it** and **Stop syncing**.
  - Details opens with "Linked with 6 others. The parts marked Synced come
    from SDCCS Pre-Premier Open. Change them there", with **Open it** and
    **Choose what syncs**. Each synced section is tagged **Synced** and
    can't be edited. The name, date and registration number always can.

For SDCCS: link all seven and make the first one the primary; everything
syncs. A day at a different venue switches its own Where off.

### 8. Linked competitions in lists

A list should show at a glance which competitions go together: a weekend
pair should look like a pair (Murray, 2026-10-11). A mark on each tile only
says that a competition has partners, not which ones, so lists group them.

**A rail through their date tiles** (Murray chose it, 2026-10-11). A
group's rows sit together, joined by a blue line that runs through their date
tiles, with no hairline between them. Each competition keeps its own row,
with its own tile, name, dancers and tap target.

**Where they go** is decided by one pure function, `orderLinked(items)`,
with tests. It makes the order the same everywhere and easy to scan by date:

1. **Date order, then name**, as lists are now.
2. **A group stays together, at its first day**, its own competitions in
   date order.
3. **On a group's first day, other competitions go above it; on its last day
   and after, below it.** For a weekend pair, which is most groups, every row
   stays in date order: nothing moves.
4. **Something on a middle day** (only a group of 3 days or more has one)
   **goes straight after the group.** It's the one case that leaves date
   order, and its tile still shows its own date.
5. **Two groups starting the same day** don't mix: each stays together, and
   the one whose first competition comes first by name goes first.
6. **Sections** (Today, then months): a group sits in the section of its
   first day, or in Today while any of its days is today.
7. **When some are hidden** (past ones in Upcoming, a filter, search), the
   ones left are grouped the same way. One left alone gets a line naming the
   others: "With Maritime Open, Sun 4", or "With 6 others, Jul 5–11". The
   same line shows wherever a competition appears on its own (Home's Coming
   up, a judge's or dancer's list).
8. **Search**, ordered by how well each matches, pulls a group's matches
   together at the best match's place.

The calendar's grid keeps its own dots, which count the competitions on each
day.

**Also mocked up (2026-10-11):**

- **Each group in its own card, labelled** "2 competitions, Jul 3–4". Says
  it in words, but the list breaks into many small cards.
- **One row that opens**: a group is one row with its dates, which opens to
  its competitions. Shortest, but each competition is a tap further away.

**Marks on the tile, set aside (2026-10-10 and 11):** they say a
competition has partners, but not which ones.

- **A grey tile stacked behind**: too subtle, and it can read as a
  rendering glitch.
- **A tile fanned behind in Saltire blue**: loud on every linked row of a
  long list.
- **A folded corner in Saltire blue**: it says "more" rather than "one of a
  set", so it still needs words.
- **Segments inside the tile's foot**: cramped against the weekday.
- **A capsule under the tile that splits into segments, then turns to
  dots** (like Apple Calendar's month view): two looks for one thing.
- **Dots that show this one's position, windowed past 7**: too much to take
  in.
- **Up to 5 dots, then four and a plus**: simple, but in a list you still
  can't tell which competitions go together.
- **Not a chain icon**: the link icon already means a web link everywhere in
  the app, and the copy and layers icons are taken too.

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

- Syncing platforms.
- Submitting several days at once, linked on approval.
- Making next year's competition from this year's: a one-way copy, its own
  feature.
- Live alerts across linked competitions. In-app alerts follow only the
  competition that's on today, so Saturday's results posted on Sunday
  morning don't alert.

## Consequences

- Deploy:
  - Rules: `/competitionLinks*`, plus the `.validate`s on staff and on each
    part's fields.
  - Functions: `linkCompetitions`, `competitionStaffSync`, the parts in the
    competition update trigger, `competitionDeleted`, and the set's
    published alert.
- v3's admin can't change a synced part on a competition that syncs it: it
  gets permission denied. v3's admin goes at cutover.
- Publishing the primary publishes the others that sync Listed and
  published, dancer lists and all. A day that isn't ready switches its own
  off first.
- A synced judge appears on every linked competition in their profile,
  since they're on each one's staff.

## Build order

1. Links: data, the callable, Manage's Linked competitions (no sync yet).
2. The switcher, and Overview's Linked competitions.
3. Staff sync: the copy, the trigger, the rules, Staff read-only on the
   others.
4. Details sync: the other parts, Details read-only where synced, and one
   alert when the set publishes.
