# ADR-0009: Known competitions on Submit

Status: Accepted
Date: 2026-10-11 (built 2026-10-12 on `claude/known-competitions`)

## Context

Governing bodies publish lists of their registered competitions:

| Source           | Where                                            | Format                        | Covers                                                   |
| ---------------- | ------------------------------------------------ | ----------------------------- | -------------------------------------------------------- |
| ScotDance Canada | scotdance.ca/events, "View 2026 SDC Events List" | xlsx, renamed on every update | Canada, the whole year                                   |
| ScotDance USA    | its public Google Calendar                       | ICS                           | The US, about 125 days ahead                             |
| RSOBHD           | rsobhd.net/events.ics                            | ICS                           | Mostly the UK, plus some elsewhere, about 2 months ahead |

Australia (state PDFs), New Zealand (a web page) and South Africa (links to
entry forms) have no feed worth reading yet.

The first idea (2026-10-11) was to list these competitions in the app, so
the calendar showed every competition, including the ones that don't use
ScotDance.app. A prototype matched the 2026 SDC list against production:

- 80% of it was already here, added by organisers.
- What was left was mostly small associations. They're the least likely to
  ever use the app.

Murray set public listing aside (2026-10-11):

- It risks stepping on organisers' toes for little gain.
- Families would ask the organisers why the results aren't in the app.
- Delivery apps did this to restaurants that hadn't agreed to it. The
  backlash ended with a law against it (California AB 2149, 2021).

What's left is the useful part: knowing a competition before its organiser
types it in. Submitting is the moment that knowledge helps.

## Decisions

### 1. A private index of known competitions

```
/knownCompetitions/{source}:{date}:{name, as a slug} = {
  source: 'sdc' | 'scotdance-usa' | 'rsobhd',
  date: 'YYYY-MM-DD',          // first day
  end?: 'YYYY-MM-DD',          // last day, when it runs over several
  name: string,
  venue?, address?, locality?,
  region?,                     // as the venue search puts it: AB, NC, QLD, Scotland
  country: 'CA' | 'US' | 'GB' | …,
  website?: string,
  organisations?: { [id]: true },  // the organiser, when it's an organisation here
  fetched: string,             // ISO, when this run read it
}
/knownCompetitions:runs/{source} = { at, ok?, count?, from?, error? }
```

- **It's never shown as a competition.** It isn't in lists, the calendar,
  the map or search. It only appears as suggestions on Submit.
- **It holds no contact details.** The SDC sheet has organisers' names and
  emails, and they're never read. Its organiser column (an association's
  name) is matched to an organisation here as the list is read, and only
  the match is kept: by name, a slip or two allowed in a long one
  ("HighIand"), or by short name. Never by initials, which another
  organisation can share.
- **Only what's current:** a competition that ended more than 90 days
  before the run isn't kept. (It can still be added for its results.)
- **Each run replaces a source's rows wholesale.** The sources have no
  stable ids, so nothing is diffed, and nothing public points at a row.
- **Rules:**
  - Any signed-in user can read it. It's public data, and Submit needs a
    sign-in.
  - It's indexed on `date`.
  - Only functions write to it.

### 2. Refreshed monthly, and on demand

- A scheduled function (`refreshKnownCompetitionsMonthly`) runs at 07:00
  UTC on the 1st of each month.
- System admin › Known competitions (under Manage) has one Refresh button,
  calling `refreshKnownCompetitions`, for when a body posts an update. Under
  it is each source's last run: how many it found and when, or what went
  wrong (and how many it's still offering from its last good run), with a
  link to what it read.
- **A run that fails, or finds nothing, changes nothing** but its status:
  the last good rows stay.
- **One reader per source:**
  - **SDC:** finds the "SDC Events List" link on scotdance.ca/events by its
    text, since the filename changes, then parses the xlsx.
    - Rows split into one per day become one event.
    - "Oct 24-25" is a text date.
    - A wrong year (2025 on the 2026 list) is read as the list's year.
    - The province comes from the sheet's province tab.
    - Workshops and practices are skipped.
  - **ScotDance USA:** the `(SE)`-style region prefix comes off the name.
    The end date in the feed is exclusive.
  - **RSOBHD:** competitions, championships and premierships only, not
    training sessions or meetings. The country comes from the address.
- **A bad run costs little:** fewer suggestions for a month. That's why it
  can run on its own.

### 3. "Is it one of these?" on Submit

Submit asks one question at a time (ADR 0010). After the country and date,
slide 3 shows everything known on that day (±1, since sources disagree) in
that country. It only appears when there's something to show; otherwise
it's passed by, though the progress still counts it (9 steps), so a step's
number never changes under someone.

- **"In that country"** includes one that doesn't say: a competition here
  with no country yet, or a UK one that doesn't say which nation.
- Looking takes at most 6 seconds. Offline or slow, the slide is passed by.

- **Yours last year:** competitions you manage from about a year earlier
  (±3 weeks), with "Same again".
  - It copies the name (with the year moved on), venue, organisations and
    links.
  - It doesn't copy the registration number, which changes every year.
- **From [source]:** the known competitions, under their source's name
  (e.g. "From ScotDance Canada's event list").
  - It fills the name, venue, address, town and website (as a link named
    Website).
  - It also fills the organisation, when the source's organiser matches one
    here by name.
  - One that's already here (alike in name, venue and town, as the 2026
    prototype matched them) is left out: it's under Already on
    ScotDance.app.
- **Already on ScotDance.app:** competitions someone has already added that
  day.
  - Picking one shows "It's already on ScotDance.app", with **Open it** and
    "It's a different one".
  - This stops a duplicate before it's typed. Review's same-name check
    still catches the rest.
- **None of these** carries on to the name.
- **Picking one jumps to All good?** with everything filled in, or first to
  anything still needed (a new account's name, a town the source didn't
  give), whose button then reads Back to review.
  - What came with a pick and has no question of its own shows on All
    good? with a × to take it off: its links, and Linked with.
  - Back on slide 3, the pick is marked and the button reads Continue.
    Tapping it again (or another) puts back what was there before it,
    leaving anything typed since, like your name.

### 4. Linked competitions: asked once it's sent

Murray (2026-10-11): asked of every new submission, whether or not
anything matched.

- **One submission is still one competition.** The sent screen asks
  "Another competition that weekend?", and its button names the next day
  ("Add Sunday, Oct 25").
- **It opens Submit filled in:**
  - The next day's date.
  - This one's venue, organisations and contact details.
  - The source's other days, when the picked known competition runs over
    several. A two-day row ("Oct 24-25") could be one competition over two
    days or two competitions, and the organiser says which by adding the
    second or not.
- **The new submission carries `linkedTo`:** the first submission's id.
  Its All good? shows "Linked with" the first, with a × for not linking.
  Its slide 3 doesn't offer the first back: not the known one picked for
  it, nor the first once it's approved.
- **Linking happens on whichever approval comes second.** The two can be
  approved in either order, auto-approval included. When `linkedTo`'s
  submission is approved and has a competition, approval links them:
  `writeLink(db, await pairFor(db, second, first), 'unreplaced')`.
  - These come from `functions/src/links.ts` (ADR 0007).
  - The first competition becomes the primary.
  - `'unreplaced'` syncs only the parts that wouldn't overwrite the second
    competition's own, so a different venue or description is kept.
  - If the first is already in a link, the second joins it.
  - If both are already in different links, approval leaves them unlinked
    rather than failing.
  - **Only one person's own two:** both submitted from the same account.
    Anyone else could name a popular competition's submission.
  - **Once,** though the two approvals can run at the same moment (both
    approved as they arrive): the second submission's `linked` is claimed
    in a transaction first. It ends up saying when they were linked, or
    `notLinked` says why not.
- **Listed and published sync as one part.** Both start unpublished, so
  publishing the primary later publishes the other too. For a weekend,
  that's the point.
- The submitter manages each competition through the usual approval, so
  they can change the link later in Manage.
- This takes "Submitting several days at once, linked on approval" off
  ADR 0007's Not now.

## Considered

- **Listing them publicly** (2026-10-11), with a dashed date tile and a
  chip ("Listing only", later "Not using ScotDance.app") and a page
  crediting the source. Set aside for the toes and the small gain.
  Revisit only with the governing body's agreement, credited to it.
- **Claiming a listed competition.** Not needed with nothing listed. It
  would also have needed manual review, so a claim couldn't take over a
  competition others have alerts on.
- **A chip for the country beside the date,** with suggestions under
  the date inside the old Details step (the first draft). Mocked, it made
  Submit too busy, which led to ADR 0010.
- **"Add a linked competition" in the Details step** (2026-10-11), using
  the same "+ Add …" pattern as description and registration number. It
  would make one submission create several competitions, each with its
  own name, date and review. Asking once it's sent keeps one submission per
  competition and maps straight onto `pairFor`.
- **Matching on the name as it's typed.** The date and country narrow it to
  a handful, so a person picks and no fuzzy matching is needed.

## Not now

- Australia, New Zealand and South Africa. Ask those bodies for their
  spreadsheets before scraping PDFs.
- A "known but not here" report in Manage, for inviting organisers. The
  prototype script prints it today.
- Using a known competition as a review signal, e.g. approving
  automatically when a submission matches an official list.
- Asking for access to a competition that's already here, from Submit.

## Consequences

- **Deploy:**
  - Rules: `/knownCompetitions`.
  - Functions: `refreshKnownCompetitions`, scheduled and callable.
  - Approval linking via `linkedTo`, after ADR 0007's links are deployed.
- **The prototype's parser moved into functions:**
  `functions/src/knownCompetitions.ts`, with a reader for each source and
  the refresh. The web app only queries the index
  (`web/src/lib/knownCompetitions.ts`). The prototype's report script
  stays on `claude/sdc-event-list`.
- **Submissions gain `linkedTo`** (indexed, so the first's approval finds
  the second), and the server's `linked` or `notLinked`. Review shows
  "Linked with" on both, and how it went.
- **A picked venue is text until it's resolved.** Submit looks it up as it
  does a typed one, otherwise `backfillCoords` places it on approval.
- **Drafts keep the picked suggestion,** so going back doesn't lose what was
  filled in.
- **Courtesy:** these feeds are public, with no stated terms. If a body
  asks, its source comes out.

## Build order

All four built 2026-10-12, on `claude/known-competitions`:

1. The index: data, rules, the three readers, the scheduled function, and
   Manage's Refresh.
2. Slide 3, "Is it one of these?", from the index and Already on
   ScotDance.app. Needs ADR 0010.
3. Yours last year.
4. "Another competition that weekend?" with `linkedTo`. Needs ADR 0007
   (merged).
