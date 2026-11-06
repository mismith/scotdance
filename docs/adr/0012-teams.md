# ADR-0012: Teams

Status: Accepted (Murray, 2026-10-12)
Date: 2026-10-12

## Context

Many competitions hold choreography, and some hold reel or broadsword team
events. There's nowhere to put a team, so organisers enter each one as a
dancer, typing whatever fits into First name, Last name and Location.

Murray (2026-10-12): it forces "something that isn't a person into a
person-like shape". Followers see duplicated studio names, and the real
dancers in a team lose the tracking. A list of studios, like organisations
and judges, would be good, but it has the same verification problem as
membership (dancers move between studios, or belong to several): skip it
for now, but keep it in mind.

### What production holds

A read-only scan of all 761 competitions on 2026-10-12:

- **About 3,350 choreography or team entries** in 139 competitions since
  2018, and growing: about 915 in 2025, about 970 so far in 2026.
- **Two thirds are solo choreography:** a real dancer, which fits. The
  routine's name ends up in Last name or Location.
- **1,182 are teams** in 82 competitions: duets, trios, double sword,
  broadsword and reel teams, small and large groups. They're typed at least
  eight ways:
  - title, then studio: "Scottish Sapphires •" / "Fiona MacNeil School of
    Dancing"
  - members across both fields: "Thea Conley & Keira Wiebe" / (empty), or
    "Mira Foulkes," / "Deanna Carlyle"
  - title, then members, studio in Location: "Ghillies Over Swords" / "Jane
    Schattmann, Adeline Shuhendler, …" / "Keltic Dance Academy"
  - studio, then title: "PPHD" / "Inhbir"
  - initials: "Rise" / "By F. Tolley and H. Bellingham"
  - first names only: "Dakota, Shaila, Josephine, Clare"
  - the song in Location: "Keltie Willis & McKenzie Ranger" / (empty) /
    "Better Place"
  - a title split in two: "Beltane" / "Fire"
- **About half list their members** (2 to 12 or more). The rest give only a
  title or a studio. Of the 2,015 member names, 75% already match a dancer's
  profile by name.
- **Every team row became a dancer profile:** 1,071 of the 9,144 profiles
  (12%) aren't people. 19 of them have followers (31 follows), mostly studio
  teams like "Campbell School of Highland Dance Counting Stars".
- **Teams recur:** Highland Hoppers in 9 competitions, Kids in Kilts in 6,
  "Ghillies Over Swords" (Keltic Dance Academy) three years running.
- **Studios are spelled many ways:** "KRSHD/Laura Sywyk", "KRSHD - Laura
  Sywyk", "Katharine Robinson School of Highland Dancing - Laura Sywyk".
- **92 team numbers are also a dancer's number** in another age group,
  often one of its members'.

### How entries work today

- A row in `competitions:data/{id}/dancers` is one **entry**: a number in
  one age group. Someone dancing Premier and a special event has two rows;
  their profile (ADR 0003) and its `dancerId` back-pointer tie them
  together. About 21% of entries are a second row like that, by design.
- Results, callbacks and points hold row ids; draws hold numbers. None of
  them care who's behind a row.
- Following, alerts, Home's cards, profiles and search all assume a row is
  one person.

## Decisions

### 1. A team is an entry

A team is one more kind of row in `dancers`: a number, in an age group,
placed like anyone else. Only who's behind it changes: several people
instead of one.

So results, callbacks, points, draws, numbers, the schedule, Results entry
and Draws keep working as they are. A separate `teams` section was
considered (see Considered).

Any entry with more than one dancer is a team: duets and trios, double
sword, broadsword and reel teams, small and large groups. Choreography stays
a dance. Screens say **Teams**, since "groups" would clash with age groups.

### 2. Data

```
competitions:data/{competitionId}/dancers/{entryId}

  // A dancer, as now, plus two optional fields
  number, groupId, categoryId, firstName, lastName, location, image
  dancerId      // their profile (server-written)
  title?        // the routine, e.g. a solo choreography's "Celtic Rock"
  studio?       // their dance school or teacher, as the organiser writes it

  // A team
  team: true
  number, groupId, categoryId
  title?        // "Ghillies Over Swords"
  studio?       // "Keltic Dance Academy"
  location?     // where they're from, as for a dancer
  members?:
    {memberKey}: { firstName, lastName, _order, dancerId? (server-written) }

competitions:data/{competitionId}/groups/{groupId}
  teams?: true  // its entries are teams (decision 6)
```

- **`team: true` marks it**, so a team can be just a title or a studio, as
  half of today's are. Each row says what it is, so nothing that reads one
  row (the aggregator, alerts, search) has to look up its age group.
- **Members are typed names,** not links to other rows. Most dancers in a
  choreography-only competition have no other entry to link to. Each member
  gets a profile like any dancer (decision 4).
- **A team's name,** wherever one shows (`entryName()`): its title; else its
  members ("Isla Brake & Catherine Wiedemann", "Ava, Mia and 6 others");
  else its studio; else "Team 205".
- **`title` and `studio` are on every entry.** Studio is plain text for now,
  kept in a field of its own so studio profiles can be built from it later
  (Not now).
- **No new section, so no new read rule:** a competition's teams are public
  when its dancers are.
- Alternates aren't modelled. An organiser can leave them out or list them.

### 3. v3, before and after the cutover

Teams don't wait for v3 to go. v3 keeps showing them the way it shows them
today, by name.

**There are two cutovers, and only one is in Murray's hands**
(v4 release runbook, Phase 3):

1. **The web.** Deploying v4 to the production hosting target makes
   scotdance.app v4 for everyone on the web at once, organisers included:
   Manage is in the app, and v3's `/admin` goes. One deploy, and one to
   roll back.
2. **The store apps.** 4.0.0 is an update to the same app. Most phones
   auto-update within days or weeks, but nothing can force it, so some
   phones keep v3 for months or longer. v3 nudges them through:
   - its "Update" menu item, once `versions/{ios,android}` say 4.0.0
   - from 3.15.0, the banner whose links live in
     `featureFlags/next-banner`, which can point at the store listing

**What v3 does with a team:**

- **Lists and results:** v3 shows `firstName lastName`, with the age group
  and location underneath. So until v3 retires, saving a team also writes
  `firstName` (its name) and `lastName` (its studio, when its name is its
  title). They're the same fields organisers fill by hand today, so v3
  shows a team as it does now.
  - The new app and the functions never read them on a team.
  - One helper writes them, from each place a team is saved: the form
    (beside the age group's `categoryId`, which is kept in step the same
    way), the import and the conversion tool.
  - Converting an old row keeps its first and last name as they were, so
    v3 shows exactly what it showed before.
- **Its page:** a team's entry opens in v3 like a dancer's, with its
  number, age group, location and results. It doesn't show the members.
- **Search:** v3 calls `searchDancers`, which still runs on today's
  functions. A member's search document carries the team's `entryId`,
  number and age group, and `searchDancers` returns `entryId` as the id.
  Searching a member's name in v3 then lists the team among their entries
  and opens its page. A team's title alone stops finding it in v3.
- **Following:** v3 users can still follow a team's entry. It's an
  old-style follow, kept and hidden in v4 like v3's other follows of an
  entry (`users:favorites/{uid}/oldDancers`).
- **v3's admin** saves only the cells an organiser changes (`update` on
  `{id}/{field}`), so it can't wipe a team's members or title. Editing a
  team's name there changes only v3's copy. Importing there makes
  old-style rows, which the conversion tool can convert later. Both stop
  at the web cutover.

**When v3's copies can go:** once v3 is rarely opened. App Store Connect
(App Analytics, sessions by app version) and Play Console (statistics by
app version) show it. They go in the same cleanup as the old favourites
keys, removing one helper and one rule in the loader.

### 4. Members get the profile and the tracking

- **No more profiles for teams.** The dancer aggregator (ADR 0003) skips
  team rows.
- **Each member is a person,** matched by name like everyone else. A team
  entry adds an appearance to each member's profile:
  - keyed `{competitionId}:{entryId}:{memberKey}`
  - with `team: true`, the title and the team's number
  - location and image left empty, so a team's province or studio never
    replaces a dancer's town
- **The back-pointer goes on the member:** `members/{memberKey}/dancerId`.
- **The factory learns that one row can hold several people.** A team row
  yields one record per member, and the trigger diffs members before and
  after, as it diffs a row now. Backfills walk members too.
- **Search:** each member is a document in the `dancers` collection
  (`{entryId}_{memberKey}`), so searching a name finds them. The team row
  itself isn't one.
- **A member's profile** lists the team under that competition:
  "Ghillies Over Swords · Team · 205".
- **One competition, solo and team:** someone with both shows once with
  both entries, as two rows do now.

### 5. What families see

Following a dancer covers their teams. A team can't be followed on its own
yet.

- **Competition › Dancers:** teams are listed with dancers, by name, with
  their members and studio underneath where a dancer's location goes.
  - Search finds a team by its title, studio or any member's name.
  - "Only my dancers" includes teams with someone you follow.
- **A team's page** uses the same entry route as a dancer's. It shows the
  title, number, age group and studio, then the members (each linking to
  their entry here, or their profile), then dances, draws and results as
  for a dancer.
- **A dancer's page** at a competition lists their teams among their
  entries: "Broadsword · Ghillies Over Swords · 200".
- **Schedule, Event, Group and Results:** a team row shows its name, with
  its members underneath. If you follow someone in it, the team wears that
  dancer's colour (the first one you follow, if there are several).
- **Home:** a followed dancer's card includes their team entries, with
  draws, "on next" and placings as for their own.
  - Found through the profile's appearances, which carry the entry id,
    because RTDB can't query inside `members`.
- **Alerts** go to everyone following any member, once per follower:
  - title: "Isla's team placed 1st", or "Isla and Mairi's team placed 1st"
  - body: "Ghillies Over Swords · Broadsword · Ottawa"
  - `entriesWithFollowers` reads followers through a team's members
- **Search by number** finds a team like a dancer.

### 6. Organisers: teams live in Manage › Dancers

Murray chose this (2026-10-12) over a separate Teams section, after a mock
of both (see Considered). The form was then simplified twice: once
(2026-10-14) to one form for every entry, and again (2026-11-03), because
it still felt like a maze: readers, confirms, hints and suggestions on
every step. What's left is the happy path, plain: what you see is what's
saved, and nothing is guessed.

- **One list, one import.** Manage › Dancers lists every entry, as it does
  now. An entry is listed the way the public list shows it.
- **One plain form:** Number, Age group, First name, Last name and
  Location, as a dancer always was.
  - **"Add another dancer"** turns the names into rows of First | Last,
    with "Add another dancer" under them. The heading and button follow
    the count: Add dancer, Add duet, Add trio, Add group.
  - **"Add a routine"** and **"Add a studio"** reveal those fields, for any
    entry (the Details page's pattern). A field with a value always shows.
  - Location is one per entry and gets its own row, as does Studio.
  - Taking dancers off down to one makes it a dancer again, under that
    dancer's name. Both changes toast with Undo; neither asks first.
  - Each name saves as it's edited. A pasted list fans out into rows; a
    pasted full name splits itself.
  - **Names dancing here** (2026-11-03, the first "magic" after the happy
    path): as a name's typed, the names already in this competition that
    fit show under it ("Ava" offers "Ava Reid · 101"), and choosing one
    fills the row. Only this competition's, as before; ignored, nothing
    changes. Picking isn't linking: the server links typed names to
    profiles either way. It's for typing less, not for a number: a group's
    number is its own (0 of 33 OHDA groups used a member's).
- **Never "team" on screen.** Highland organisers say duet, trio or group
  (four or more), or "N dancers". The data keeps `team`.
- **Age groups** have no Teams switch. Nothing about an entry is decided by
  its age group.
- **Numbers stay unique within an age group,** so a team can share a
  member's number from another group.
- **Deleting a team** warns about its results, as for a dancer.
- **Results entry and Draws** need nothing new beyond showing team names.

### 7. Importing: plain rules

Organisers import the entry list they already have. Two rules make a duet,
trio or group, and nothing else is guessed:

- **Names joined by "&"** in a name cell, even across both cells ("Ava
  Reid &" / "Mia Lee"), are one entry's dancers.
- **Rows sharing a number in an age group** are one entry, its dancers in
  row order. (A repeated number used to be an error.)
- **Column headings can be changed:** the file's columns show as a small
  table, each heading a picker over its first rows. A table's headings can
  name Studio, Routine and Dancers; a program's columns are Number, names,
  Location, then Studio only under a Studio heading.
- **The plan is the list as it'll show:** entries by age group, as on
  Dancers, with rows that can't be imported marked "it'll be left out", and
  changes on a re-import marked Changed.
- **Matching an updated list** works as now, by number within an age
  group, so re-importing changes teams rather than duplicating them.
- The recogniser (`teamReader`) is kept for the conversion script, not the
  import.

### 8. Converting existing rows

A one-off script, not a screen (2026-11-03): organisers never see old
competitions' team rows as anything but what they were. It reads each
competition's rows typed as dancers in age groups for teams with
`teamReader` (tested on 1,182 production rows: 30 of 36 right with no
fixes on a first try, then each miss pattern fixed and unit-tested), and
writes teams.

- **What it converts** (a one-off script run 2026-11-05, kept with its
  backups in `scotdance-backups`): rows in
  age groups named for teams; elsewhere, rows listing two or more dancers
  (choreography's "Premier Group A" mixes solos and groups); solo rows with
  a routine typed into the name. What one row can't settle, all of
  production does: who dances anywhere ("Annika" | "Bruinsma" is a dancer,
  "Candy" | "Land" a routine), their first names ("Soldier, Poet, King"
  is a routine), towns, and studios typed in many rows ("Kids in Kilts").
  Rows still in doubt (6 of about 1,560) stay as they were, listed first
  in its report with its best guess.
- **Alternates are dancers** ("(ALT Sinclair Craig)"), listed last, not
  marked (Murray, 2026-11-05).
- **A teacher's name where the town goes is the studio** ("Laura Sywyk"):
  a person's name that isn't a town typed elsewhere with its province.
- A converted row keeps its first and last name for v3 (decision 3).
- **Converting drops the team's old profile,** to `dancers:retired` as
  usual, and its follows go with it (31 on 19 profiles).
- **Backed up before each run** to `scotdance-backups`.

### 9. Privacy

Studios and teams become data that's shown, as programs already print them.
Many studios call themselves schools ("Campbell School of Highland Dance"),
so "school" comes out of the lists of what's never asked for.

- **About** (the privacy answer):
  - "the same names, numbers, towns, studios, teams, age groups and
    results as the program…"
  - "Nothing like a birthdate, home address or contact details is ever
    asked for…"
- **Privacy page**, the list for dancers:
  - "name, competitor number, where they're from (…), dance studio, age
    group, any teams and routines, dances and placings"
- **Privacy page**, below that list:
  - "has nowhere to put a dancer's birthdate, home address or contact
    details"

## Considered

- **A separate `teams` section.** A cleaner name, but results, callbacks,
  points and draws would hold ids from two places. Every reader would have
  to look in both: Results entry, Placed list, Draws' strays, Group, the CSV
  export, alerts and the seed. Today an id that isn't found shows as
  "Deleted dancer" or is dropped. `dancers` already holds entries, not
  people.
- **A Teams section in Manage, after Dancers** (the first draft). It means
  two lists, two forms and two imports for what organisers keep as one
  entry list: a dancer's solo choreography would be in Dancers and their
  duet in Teams.
- **A separate team layout or template to import.** Organisers would have
  to learn it and redo their lists. Their programs already hold teams in
  some shape, and the recogniser reads the shapes found in production.
- **Members as links to other rows.** That needs a row for every member, and
  most dancers in a choreography-only competition have none. A row with no
  age group would break "an entry is a number in an age group".
- **Separating people from entries everywhere:** a list of people, plus
  entries that point at them. Profiles already are that layer of people.
  This would migrate every competition for little gain.
- **Following a team.** Members change from one competition to the next,
  and routines change names. Following the dancers covers families.
  Teachers following a studio waits for studio profiles.
- **Readers and confirms on the form** (second pass): a reader that split a
  pasted name into a title, studio and dancers, "Did you mean" for near
  misses, "Make this a team?", and an import that guessed teams from age
  group names with a Teams chip to switch. Each was reasonable; together
  every step had three versions, and anything off the happy path got lost.
- **A conversion screen** (Make teams, with a finder in System admin). Old
  rows are a one-off; a script does it once, without a screen to learn.
- **Waiting for v4 to replace v3.** Simpler, but it ties teams to the
  cutover date, and choreography season runs January to March.

## Not now

- **Studio profiles** (`/studios`, like venues). Identity would come from
  the studio field. Spellings need merging, and nothing would verify who
  dances where. The field is there so this can be built on real data.
- **Routine pages:** "Ghillies Over Swords" by Keltic, three years running,
  identified by title and studio. Revisit with studios.
- **Points across team entries,** like OHDA's "Champagne Highest Points
  Trophy", which lists every member again as a dancer.
- **Overall in single-dance age groups.** 474 of the 509 choreography age
  groups with results also have an Overall entered, because a category that
  isn't Primary expects one. That's a separate question.
- **Alternates.**

## Consequences

- **Deploy functions** for the aggregator's members, member search
  documents and alerts (the runbook's "Teams" section lists them). No rules
  change.
- **Every `dancers` reader has to tell a team from a dancer,** through one
  `isTeam()` and one `entryName()` in web and functions. Anything keyed on
  `firstName` changes: the loader drops rows without a name, and alerts use
  the first name.
- **Team saves write the v3 copies** (decision 3) until v3 retires.
- **The e2e seed** renames members as people (they're real names) and adds a
  few teams, so CI covers them. Its leak check catches any name it misses.
- **`history.ts`** ignores `members/*/dancerId`, as it does `dancerId`.
- **Until its competition is converted,** an old team still shows as a
  dancer, profile and all.
- **The data counts above come from a one-off scan.** It isn't kept; the
  conversion script's own detection replaces it.

## Build order

1. **Data and display:** types, `isTeam()` and `entryName()`, the loader,
   and team rows shown properly wherever entries are listed. Teams are
   entered by hand in the emulator for now.
2. **Backend:** members in the aggregator, member search documents, alerts.
3. **Manage:** teams in Dancers, one entry form with its Dancers rows,
   v3's copies; Routine and Studio; the privacy copy (studios start being
   collected here).
4. **Viewing:** the team page, teams on a dancer's page, Home cards, "Only
   my dancers", colours; `searchDancers` returning a member's team for v3.
5. **Import:** "&" and shared numbers, changeable column headings, and the
   template's Studio column and example duet.
6. **The conversion script,** using the recogniser, run on production
   ahead of the 2027 choreography season.

Seed and e2e changes go with each step.
