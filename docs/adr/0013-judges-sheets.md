# ADR-0013: Judges' sheets

Status: Accepted
Date: 2026-10-28 (built on `claude/judges-sheets`)

## Context

ScotDance Canada asked (April 2026, again in June) for organisers to post the
judges' placings for Championships and Premierships: the sheets that show how
each of the three judges placed the dancers, usually taped to a wall at the
venue. Posting them in the app saves printing them, and reaches the people
who aren't at the venue.

The sheet comes from the scrutineer: an export from their software, or the
printout itself. The app already has each dance's final placings; the sheet
is the working behind them.

## Decisions

### 1. Pictures of the sheet, not typed marks

Typing every judge's marks into the app would triple the data entry on the
day, for a sheet the scrutineer has already printed. Organisers add a photo
of it, or its PDF. (`points[groupId][danceId][judgeId]` could still hold
typed marks one day, from an export, if a scrutineering app offers one.)

### 2. Per dance, page by page

`competitions:data/{id}/sheets/{groupId}/{danceId}/{pageId}` =
`{ url, path, width, height, _order }`, shaped like `results` and `points`
(Overall is a dance id too). A sheet has up to 6 pages (`MAX_SHEET_PAGES`).
Organisers add it under the dance's results in Manage › Results; everyone
sees a "Judges' sheet" row under that dance's placings on the age group's
page.

### 3. Made small on the organiser's device

Every page becomes a greyscale picture about 2000 px on its long side, the
paper lifted to white and the ink to black (photos taken under hall lights
come out grey), WebP where the device can make it, at most 320 KB
(`lib/admin/sheetImage.ts`). Quality gives before resolution, so the small
print stays readable when zoomed in. A 4 MB phone photo came out at about
300 KB; a PDF page from software at about 35 KB.

A PDF's pages are drawn as pictures by pdf.js (`lib/admin/pdfPages.ts`),
then go the same way as a photo, so everyone sees every sheet in one viewer
and no PDF reader ever loads for them. pdf.js (about 2 MB with its worker)
loads only when an organiser picks a PDF. Sheets are exports from
scrutineering software, not scans, so pdf.js's decoders for scanned pages
aren't shipped; a font a PDF names without including is drawn with the
device's own. A page that comes out blank (an export's empty last page, or
a scan after all) is left out, and the organiser is told.

### 4. Nothing downloads until someone opens a sheet

The row under a dance is words and an icon: no thumbnail, so a results page
costs nothing more to view. Files are named once and cached for good
(`immutable`). Organisers see their pages themselves in Manage, to check
they picked the right photo.

### 5. Deleting a page deletes its file

The storage rules let anyone signed in add files but never replace or delete
them (see `storage.rules`), so `competitionSheetsChanged`
(`functions/src/sheets.ts`) deletes the files of pages that are gone from an
age group's sheets: one page, a dance, an age group. Deleting a competition
clears its whole folder (`competitions/sheets/{competitionId}/`).

Because the function deletes whatever a page names, the database rules hold
a page's `path` to its own competition's folder, and the function checks
again; a page's `url` must be the app's own bucket, so no page shows a
picture from someone else's server. Deleting a page asks first rather than
offering Undo (the file is gone), and sheet changes stay out of Manage's
history for the same reason. Deleting a dance or an age group deletes its
sheets in a write of their own, after the rest: its confirmation says so,
and Undo brings back the dance, not the sheets.

### 6. Sheets load on their own, and quietly

They're their own section (`fetchSheets` / `watchSheets`, streamed on
competition day like results). A page that can't read them shows the
results without them, never an error: the app can ship before or after the
rules that let it read them.

### 7. The viewer

A frosted paper sheet, like everything that opens over the page. Pinch or
double-tap to zoom in (up to one and a half times the picture's own
pixels), drag to look around, swipe for the next page; with a mouse or
trackpad, double-click, Ctrl and scroll, the + and − buttons and the arrow
keys. Each picture is drawn at its own size and scaled down to fit, so
zooming in shows real pixels.

## Rollout

1. `firebase deploy --only database,storage` (the `sheets` rules).
2. `firebase deploy --only functions:competitionSheetsChanged,functions:competitionDeleted`.
3. Then the web and the apps. In that order nothing breaks: before the rules,
   the app shows results without sheets (decision 6).

## Costs

A big championship is maybe 75 pages, about 20 MB: pennies a year to keep.
Downloads happen only when someone opens a sheet, at about 300 KB a page.

## Not done

- Reordering a sheet's pages (they keep the order they were added in).
- Files nothing names: one uploaded just as its record failed to save, or
  junk anyone signed in uploads (as in every other upload folder). They go
  only when the competition does.
- A link to the sheet from a dancer's own page.
- A mark on Manage › Results' list for dances with a sheet.
