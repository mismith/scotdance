# ADR-0004: Admin moves into the v4 app

Status: Accepted (built on branch `admin`)
Date: 2026-09-30
Supersedes: ADR-0001 §1.3–4, §4 (the `/admin` rewrite), §7 (admin in the system browser) and the "pushed to admin" part of §8

## Context

ADR-0001 kept the Vue 2 admin alive at `/admin` and had the native app open it
in the system browser. That leaves two apps to maintain, one of them on a dead
stack, and organisers bouncing between a phone app and a desktop-era web page.

Who uses admin: usually one volunteer per competition, often on a laptop,
sometimes on a phone in the audience. Dancers arrive as an Excel sheet. Results
are read out and entered live.

## Decisions

### 1. One app

Admin is part of `web/`, behind permissions, on web and in the native apps. v4
doesn't launch until it's in. The old app (`www/`, root `src/`) retires at cutover.

- `/competitions/:id/manage/...`: one competition (organisers and system admins)
- `/manage`: the competitions you can manage
- `/admin/...`: system admin (submissions, users, tools/backfills)
- `/competitions/submit`, `/competitions/:id/invites/:inviteId`: public flows
- Old links (`#/...`, `/competitions/:id/admin/...`, `/admin/info/...`) redirect in-app

### 2. Same data model and rules

No schema or rules changes. Writes are multi-path updates under the namespace, so the
existing rules (competition admins via `users:permissions`) do the guarding.
Every edit clears the public caches for that competition.

### 3. Lists and detail, autosave, Undo

- List and detail side by side from `md`, sections sidebar from `lg`; on phones
  Back climbs one level at a time.
- Fields autosave (debounced, Enter, blur); Escape reverts.
- Deletes and bulk changes confirm when they matter. Every change goes into
  an undo history for the visit (Undo/Redo buttons, Cmd/Ctrl+Z); undoing
  something another admin has since changed asks first. Invites stay out of
  it, since redoing one would send the email again.
- The Handsontable spreadsheet is gone: bulk select plus "Set" covers the
  common edits, and the Excel import covers the big ones.

### 4. Results stay tap to pick

Tap dancers in the order they're announced. Number entry with read-back was
rejected as slower and more error-prone, and there's no on-screen keypad. The
"?" placeholder stays, so organisers can carry on and fix it later. The screen
mirrors the old admin's on purpose (dance list, Placings/Points, Championship
switch, TIE switches, tap to take out): organisers know it, and a new
mechanism is a risk on the day.

### 5. No offline writes

Admin needs a connection. Inputs disable and say "Offline" when it drops.
Merging edits made offline against live results would be messy and risky.

### 6. Excel import

`read-excel-file` (xlsx and csv; not legacy .xls) parses either the program
layout or a plain table. Matching is by number within an age group, since the same
dancer can be entered in two groups. The plan shows new, changed, moved and
missing dancers before anything is written; re-importing the same file changes
nothing.

## Consequences

- One codebase and one store listing; organisers get admin on their phone.
- `vue-draggable-plus` and `read-excel-file` are lazy chunks, so the public app
  doesn't pay for them.
- Hosting no longer needs an `/admin/**` rewrite to the old app.
- Venue search needs a Google Maps key with the Places API; without one it falls back to typing.
