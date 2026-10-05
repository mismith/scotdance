# ADR-0005: Organisations

Status: Proposed (prototype on branch `claude/v4-orgs-push`)
Date: 2026-10-03
Supersedes: the parked `feat/organizations` (2022) and `feat/series` (2021) branches

## Context

Competitions are run by associations and games societies, and many belong to
a championship series as well. Nothing on ScotDance.app says so: there's no
page for "the FHDA's competitions", and an association that runs five
competitions a year starts from nothing each time.

Two earlier attempts stalled on permissions (who may edit an organisation,
and who may say a competition belongs to one). Series were a separate
branch, though a series is just an organisation that competitions it doesn't
run belong to.

Decided with Murray (2026-10-03):

1. Submitting a competition offers your organisations, or a new one; making
   a new one makes you its admin.
2. Organisation admins at launch.
3. A competition can belong to more than one (host and series).
4. Existing competitions get tagged, with tools to make it quick.
5. A page has logo, names, description, website and links.

## Decisions

### 1. One kind of organisation, many per competition

`/competitions/{id}/organisations/{organisationId} = true`. Hosts and series
are the same thing; the competition page lists them all under
"Organisation(s)". No `kind` field until something needs to treat them
differently. `feat/series` is retired by this.

### 2. Curated records, not aggregates

Unlike venues and judges (ADR 0003), organisations aren't derived from text:
the same body is typed many ways ("BCHDA", "B.C. Highland Dancing Assoc."),
and an organisation has things a competition record doesn't (logo,
description, its own admins).

```
/organisations/{id} = { name, shortName?, image?, location?, website?,
                        description?, links?, created, createdBy }
/organisations:data/{id}/invites/{inviteId}            admins' invites (private)
/organisations:permissions/{id}/users/{uid} = true     who its admins are
/users:permissions/{uid}/organisations/{id} = true     what you're an admin of
```

The permission pair mirrors competitions' exactly, and invites reuse
`FirebaseInvites` (functions `organisationInvite*`), so the Admins screen is
one component for both (`AdminsPanel`).

### 3. Who can do what (rules)

- Anyone reads `/organisations`.
- An organisation's admins edit its page (not create or delete it: that's
  functions and system admins).
- **Linking** a competition: an organisation's admins can add any
  competition to it (a series takes in competitions it doesn't run) and take
  any off. A competition's admins can take any organisation off theirs, and
  add only organisations they're an admin of (a `.validate` on the link).
  System admins can do both.
- Being an organisation's admin does **not** give access to its
  competitions. Each competition keeps its own admins, as now (Murray,
  2026-10-03). Revisit if associations ask: it would be a function that
  mirrors org admins onto their competitions.

### 4. Making one

- **In Submit** (step 1): your organisations as one-tap chips, or "Add an
  organisation": search every organisation, or start a new one (name and
  short name). Nothing is created until approval:
  `competitions:submissions/{id}/organisations` (existing) and
  `/newOrganisations` (new). Approval (functions `submissions.ts`) makes the
  new ones with the submitter as admin and lists the competition under all of
  them.
- Picking one you're **not** an admin of is allowed in Submit: System admin ›
  Submissions shows "Not one of its admins: check it's theirs to claim", and
  Murray decides at approval, as he already reviews every submission
  (confirmed 2026-10-03).
- **Elsewhere** (Manage › Details, Manage, System admin): the
  `createOrganisation` callable, since people can't grant themselves access.
  Anyone who manages a competition or organisation can call it. System
  admins can make one without becoming its admin (`join: false`).

### 5. Where they show

Organisations always go last: at the bottom of a page, a menu, a form step
or search results, after everything else there (only Delete sits below
them, on Manage › Details).

- **Competition rows** (lists, calendar, map, Home, Search, Manage) lead with
  its organisation's short name: "CHDA Winter Wonderland" reads "CHDA ·
  Winter Wonderland", the organisation (short or full name) dropped from the
  front of the name so it isn't said twice (`lib/competitionTitle.ts`). With
  several, the one the name starts with, else the first by short name; none
  without a short name. Not on the organisation's own page, nor the
  competition's own header, which keep the name as it is.
- **Competition page**: an "Organisation(s)" section after the judges and
  pipers.
- **Organisation page** `/organisations/:id`: logo (rounded square, so it's
  never mistaken for a person), name, short name · based in · N competitions
  since YYYY, Follow, website, Manage (for its admins), description, links,
  then its competitions (coming up, then past by year), as venue and judge
  profiles do.
- **Organisations index** `/organisations` (sidebar, More, Search's browse
  tiles, last in each): only organisations with a listed competition, so an
  empty one (just made) doesn't show.
- **Search**: matched on the device by name, short name or where it's based;
  the last group of results.
- **Manage** (`/manage`, renamed from "Manage competitions" now it lists
  both): "Your organisations" below your competitions.
- **Organisation Manage** `/organisations/:id/manage`: its page, its
  competitions (add, take off, Undo), its admins (invite, remove).

Data: `/organisations` is read whole (tens, not thousands) and kept on the
device like favourites; each organisation's competitions come from the
competitions list the app already loads. No server index.

### 6. Tagging existing competitions (System admin › Organisations › Tag)

~800 competitions, most of them yearly. The tool groups them into
**families** (same name without year or edition: "The 46th Annual Bow Valley
Highland Games" and "Bow Valley Highland Games 2025" are one family), so one
tap tags every year.

- Progress: "N of M listed competitions have an organisation".
- Filters: From this year / Every year, Untagged only, search.
- Suggestions on each family: strong when other years are tagged ("Tagged
  in 3 other years"), weak when an organisation's short name or full name is
  in the competition's name. "Tag them all" applies every strong one at once.
- Organisations the names point to that aren't here yet ("EHDA Evelyn
  Gerard Jones Competition", "Scotdance Alberta Open"): an abbreviation or a
  ScotDance association, with how many competitions name it and where most
  of them are. Start one from a prefilled sheet (name, short name, based in)
  and it's added to every competition that names it. Full names for
  abbreviations aren't guessed.
- Each family is a card: one year shows its date and visibility; several
  open inside the card as dated rows.
- Select families or single years, then "Add to…" (any organisation, or
  start one) or "Take off…". Every change toasts with Undo.

Grouping and suggestions are pure functions (`lib/organisationTagging.ts`,
tested).

### 7. Storage

Logos and files go in `organisations/info` and `organisations/links`, with
the same limits as competitions' (`storage.rules`).

## Consequences

- Deploy: database rules, storage rules, functions (`createOrganisation`,
  `organisationInvite*`, `organisationDeleted`, updated submissions).
- A new Postmark template, `organisation-admin-invite` (model: `app`,
  `organisation`, `invite.link`), in `postmark/` with the others. Until it's
  pushed, invites say the email didn't go and offer Copy link, as
  competition invites do.
- The approval email doesn't mention a new organisation yet.
- v3 ignores the new field on competitions; its admin writes field by field,
  so it won't wipe it.

## Open questions

- Merging duplicates (System admin): needed once people start creating them.
- Follow an organisation → alert when it lists a new competition (ADR 0006
  has the alert plumbing).
