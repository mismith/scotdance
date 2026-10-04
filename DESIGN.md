---
name: ScotDance.app
description: Highland dance competitions, live on every family's phone.
colors:
  saltire-blue: "#0065bd"
  saltire-blue-night: "#62aaf0"
  tartan-red: "#b0102c"
  live-pink: "#c8166a"
  live-paper: "#fde7f1"
  next-amber-paper: "#ffefc7"
  next-amber-ink: "#7a4600"
  done-green-paper: "#ddf2e2"
  done-green-ink: "#145c2b"
  blue-paper: "#e1ecf8"
  destructive: "#b42318"
  ink: "#12161b"
  mist: "#f2f4f7"
  paper: "#ffffff"
  slate-wash: "#e9edf2"
  slate-text: "#454e59"
  hairline: "#d3dae2"
  field-edge: "#87919e"
  night: "#0c0f13"
  night-card: "#161b21"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 760
    lineHeight: 1.25
    letterSpacing: "-0.024em"
  title:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.014em"
  headline:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 650
    lineHeight: 1.375
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.375
  small:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.375
  footnote:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.375
  numeral:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 700
    fontFeature: "tnum"
rounded:
  md: "0.375rem"
  xl: "0.75rem"
  2xl: "1rem"
  3xl: "1.5rem"
  menu: "1.375rem"
  sheet: "1.75rem"
  full: "9999px"
spacing:
  gutter: "1rem"
  row-x: "1rem"
  row-y: "0.625rem"
  section: "1.5rem"
  page-column: "48rem"
  sidebar: "17rem"
components:
  button-primary:
    backgroundColor: "{colors.saltire-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    height: "2.75rem"
    padding: "0 1rem"
  button-tonal:
    backgroundColor: "{colors.blue-paper}"
    textColor: "{colors.saltire-blue}"
    rounded: "{rounded.full}"
    height: "2.75rem"
    padding: "0 1rem"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "2.75rem"
    padding: "0 1rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    height: "2.75rem"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.2xl}"
  list-row:
    backgroundColor: "{colors.paper}"
    height: "4rem"
    padding: "0.625rem 0.75rem 0.625rem 1rem"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "2.75rem"
  chip-next:
    backgroundColor: "{colors.next-amber-paper}"
    textColor: "{colors.next-amber-ink}"
    rounded: "{rounded.full}"
    height: "1.75rem"
  chip-done:
    backgroundColor: "{colors.done-green-paper}"
    textColor: "{colors.done-green-ink}"
    rounded: "{rounded.full}"
    height: "1.75rem"
  chip-private:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    height: "1.5rem"
  date-tile:
    backgroundColor: "{colors.slate-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    width: "2.75rem"
  number-card-xs:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    width: "2.75rem"
    height: "2rem"
  number-card-md:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "0.5rem"
    width: "5.5rem"
    height: "4rem"
  number-card-xl:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    width: "11rem"
    height: "8rem"
  dancer-day-card:
    backgroundColor: "{colors.paper}"
    rounded: "1.25rem"
    padding: "1rem"
  rosette-lg:
    textColor: "{colors.saltire-blue}"
    height: "3rem"
    width: "2.55rem"
  chip-pinned:
    backgroundColor: "{colors.slate-wash}"
    textColor: "{colors.slate-text}"
    rounded: "{rounded.full}"
    height: "2rem"
    padding: "0 0.75rem"
---

# Design System: ScotDance.app

## Overview

**Creative North Star: "The Front Row"**

The best seat at a Highland dance competition is at the edge of the platform: close enough to see every step, calm enough to follow your own dancer through a long, loud day. The app is that seat. Everything a family needs (when their dancer is on, where, and how they placed) sits at a glance, and nothing stands between them and the dancing. It is native and calm: a well-made phone app, not a website, with quiet paper surfaces, one confident blue, and rich detail kept for touch and state.

Density follows the visitor. The public app is spacious and glanceable for one-handed use in sun and noise; Manage is the same system, tighter, for an organiser at a laptop. Colour is news, not decoration: pink means something is live right now, green means done, amber (in Manage) means what needs the organiser next, and each followed dancer carries their own colour everywhere they appear.

**Key Characteristics:**
- Atkinson Hyperlegible everywhere, rem-based so the phone's text size (in the app) and browser zoom scale it all.
- Flat paper on a cool mist background; glass only for floating chrome; one textured brand panel per surface at most.
- Continuous (squircle) corners on every rounded shape; capsules for buttons and chips.
- iOS-style lists: full-width rows, inset hairline separators, a tint on press.
- Motion that follows the finger: pages slide toward what you tapped and back out the way they came.

## Colors

One confident blue for action, a Scottish red kept for favourites, and a small set of state colours that only appear when they carry news.

### Primary
- **Saltire Blue** (#0065bd; #62aaf0 at night): the flag's blue. Primary buttons, links, the selected tab, focus rings and the admin shield. One filled primary per view.

### Secondary
- **Tartan Red** (#b0102c): follows and favourites (the filled star), and the first dancer colour. Never a second action colour.

### Tertiary
- **Live Pink** (#c8166a on Live Paper #fde7f1): only while something is happening now: today's date tile, the live dot, "Today" headings, fresh results. Gone the moment it isn't live.

### Neutral
- **Ink** (#12161b): text and the Private chip.
- **Mist** (#f2f4f7): the page behind everything.
- **Paper** (#ffffff): cards, rows, fields, sheets.
- **Slate Wash** (#e9edf2): date tiles, chips, quiet fills.
- **Slate Text** (#454e59): secondary text (7:1 on paper).
- **Hairline** (#d3dae2): separators and borders.
- **Field Edge** (#87919e): input outlines (3:1 on paper).
- **Night** (#0c0f13) and **Night Card** (#161b21): the dark theme's page and paper.

State papers: **Next Amber** (#ffefc7, ink #7a4600), in Manage only, for what needs the organiser next (a "?" placing, the next section). Families' screens don't guess what's on next: plenty of competitions post nothing until the end, so upcoming dances show their schedule facts instead; **Done Green** (#ddf2e2, ink #145c2b) for finished; **Blue Paper** (#e1ecf8) for tonal buttons and the current sidebar row; **Destructive** (#b42318) for deleting.

Dancer colours: eight saturated hues (red, green, purple, ochre, blue, teal, magenta, orange), all 4.5:1 with white text, assigned per followed dancer and used for their number card band, dots and bars.

**The Colour Is News Rule.** Pink, amber and green appear only when they report a state (live, next in Manage, done). A screen with nothing happening is blue, ink and paper. Finished or out-of-the-running things are muted by colour and say so in words, never faded with opacity.

**The One Blue Rule.** Saltire Blue fills at most one button per view; everything else that acts is tonal, paper or plain text.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with system-ui fallback)
**Body Font:** Atkinson Hyperlegible Next
**Mono Font:** Atkinson Hyperlegible Mono, only where an organiser checks pasted data cell by cell (the dancer import's paste box and preview table). Numbers elsewhere use the main face, extra bold with tabular figures: the number card reads like a printed bib, and Manage's number tiles match it.

**Character:** A typeface designed for readers with low vision: open shapes, unmistakable letters (no I/l/1 confusion). It reads friendly and plain rather than stylish, which is the point.

### Hierarchy
- **Display** (760, 1.875rem, tight, -0.024em, balanced): a page's own title (a competition's name, a dancer's name under their bib). Home's greeting is a step up at 2rem.
- **Title** (700, 1.3125rem, tight, -0.014em, balanced): sheet titles and big section openers.
- **Headline** (650, 1.0625rem, snug): section headings above lists ("Coming up").
- **Body** (400 to 600, 1rem): list rows (names semibold), paragraphs. Never smaller than 16px for reading text.
- **Label / Callout** (600 for labels, 0.9375rem): buttons, chips, secondary row lines, the line under a page title.
- **Small** (0.875rem): counts beside headings, small chip labels.
- **Footnote** (0.8125rem) and **Caption** (500, 0.75rem): dates under tiles, metadata.

**The Sentence Case Rule.** Labels are sentence case and bold; no uppercase tracked micro-labels (except the month on a date tile).

**The Title First Rule.** A page leads with its title; its date, place or category follows underneath at Callout size. Nothing sits above a heading.

**The Figures Rule.** Competitor numbers, times and counts use tabular figures so columns don't jiggle.

## Layout

One column, at most 48rem wide, with a 1rem gutter on phones. From 64rem the tab bars become a 17rem sidebar on the left and the app bar keeps to the column. Fixed chrome reserves its space: `--chrome-top` (3.5rem plus the safe area) above and `--chrome-bottom` (the floating tab bar) below. Sections stack with 1.5 to 2rem between them; a heading sits 0.625rem above its card. Lists are full-width cards of rows at least 4rem tall, separators inset to line up with the text (4.5rem when rows lead with a date tile or number card). Manage on wide screens is a split view: list beside detail, never a stack of panels.

## Elevation & Depth

Flat by default. Content sits on paper that is defined by a hairline and a whisper of shadow, not by borders. Depth only means "this floats": menus and sheets are raised; floating chrome (tab bar, app bar buttons) is frosted glass that stays mostly opaque so labels never lose contrast; notices use one dark glass in both themes.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 0 0 0.5px rgb(18 22 27 / 0.09), 0 1px 2px rgb(16 24 40 / 0.05)`): every content surface.
- **Raised** (`box-shadow: 0 0 0 0.5px rgb(18 22 27 / 0.06), 0 10px 30px -8px rgb(16 24 40 / 0.2), 0 2px 6px rgb(16 24 40 / 0.06)`): menus, sheets, popovers.
- **Glass** (`backdrop-filter: blur(24px) saturate(1.8)` over 72% paper, lit top edge, `0 8px 28px rgb(0 0 0 / 0.14)`): floating chrome only; solid under Reduce Transparency.

**The Flat Paper Rule.** Only the brand panel (Home's pitch, About's hero) gets texture and gradient light. Everything else is flat paper.

## Shapes

Every rounded shape uses continuous corners (`corner-shape: superellipse(1.5)`), as iOS draws them, except full capsules and circles. Cards and grouped lists are 1rem (rounded-2xl); tiles and fields 0.75rem (rounded-xl); sheets 1.75rem at the top; menus 1.375rem; buttons, chips and the tab bar are capsules. The competitor number card is the one object with its own silhouette: white paper with a coloured band and two safety pins.

## Components

### Buttons
- **Shape:** capsule (9999px), 44px tall (36px to the eye for small ones, still 44px to the finger).
- **Primary:** Saltire Blue fill, white label, a faint blue-tinted lift; one per view.
- **Tonal:** Blue Paper with a blue label: the usual secondary action.
- **Secondary:** paper with the card shadow; **Plain:** blue text only; **Destructive:** red fill.
- **States:** press tints or shrinks within a frame and springs back; busy keeps the label and adds a spinner; disabled at 40%.

### Chips
- **Style:** capsules 1.5 to 1.75rem tall, label weight. State chips use the state papers (Done, Live; Next in Manage).
- **Visibility:** Private is solid ink with a crossed eye; Unpublished is outlined with an hourglass; Published shows nothing.

### Cards / Containers
- **Corner Style:** 1rem continuous.
- **Background:** Paper on Mist.
- **Shadow Strategy:** Card shadow at rest (see Elevation).
- **Internal Padding:** 1rem; rows carry their own padding.

### Inputs / Fields
- **Style:** paper well, 1px Field Edge inset outline, 0.75rem corners, 44px tall.
- **Focus:** 1.5px Saltire Blue edge plus a soft 4px halo.
- **Error:** 1.5px destructive edge; the message is a full sentence below.

### Profile Hero
A person's or place's page (dancer, judge, piper, venue) opens centred, as a competition dancer's page does under their number card: a 96px avatar (initials in the dancer's colour when followed) or the venue's map pin tile, the name at Display size, one line of who or where, then Follow (or Favourite) at a button's width. Outside a competition there is no number card; inside a dancer's history each competition row shows the number they wore there as a small card, then their rosettes.

### Navigation
- **Tab bar:** a floating glass capsule at the bottom on phones (Home, Competitions, Search, More); inside a competition it swaps to that competition's tabs with a round "leave" button beside it. The current tab sits on a quiet pill.
- **App bar:** a back button that names where it goes, the title once the page's own title scrolls under, and up to two icon actions (36px in chrome).
- **Sidebar (64rem+):** the same destinations in a list, the current one on Blue Paper.

### Date Tile (signature)
A small calendar page leading a competition row: month, day, weekday (or year). Slate Wash at rest, Live Paper and Live Pink while it's on; an outlined blue shield badge in its corner when you organise that competition.

### Competitor Number Card (signature)
The bib a dancer wears: bold tabular number on white paper, a band in the followed dancer's colour, two safety pins drawn flat in one stroke (coil, arms, clasp). Only ever shown inside a competition, never as someone's identity. Sizes run from a 44px list tile (plain, no band or pins unless the dancer is followed) to the 88px card that leads a dancer's day and the 176px poster-size card that leads a competition dancer's page.

### Dancer Day Card (signature)
**The Number Card:** the bib your dancer wears is the hero object. Each followed dancer's card on Home and a competition's Overview is paper at 1.25rem (20px) continuous corners, one step rounder than an ordinary card, and leads with their 88px number card, name (1.25rem bold) and age group. Placings pin on as 48px-tall rosettes in a row (beside the name when the card is 34rem wide or more, under it on a phone), Overall set apart by a hairline with its label, then 2rem capsule chips (taller than the usual chip, to sit level with the rosettes) for callbacks, championship points and "Results to come". The dances still to come sit at the foot, each with "From" its event's or session's start time, platform and draw right-aligned in tabular figures. Dancer colour lives only on the bib's band.

### Rosettes
A placing is a rosette, one blue for every place, its dance named only in its spoken label ("Highland Fling: 1st place, tied"); the dancer's page lists each dance by name. A championship point is a blue-paper chip, shown as a result, not as a miss.

### Scott (the logo dancer)
The dancer in the mark, drawn whole (never cropped, never given a face) in Saltire Blue, or white on the brand panel. He appears sparingly: About's hero, Home's pitch before anyone is followed, and the nothing-yet empty states (no one followed, no competitions here). Never on competition-day screens, errors or no-match results, where the news is the point.

## Do's and Don'ts

### Do:
- **Do** keep one filled Saltire Blue button per view; make the rest tonal, paper or plain.
- **Do** use pink, amber and green only for live, next (in Manage) and done.
- **Do** give every icon-only button a 44px target (36px inside chrome) and an accessible name.
- **Do** honour Reduce Motion (pages just change, scrolls jump) and Reduce Transparency (glass turns solid).
- **Do** give every placing its dance in the rosette's spoken label, and give upcoming dances the schedule's facts (platform, start time, draw), never a guess at what's on now.
- **Do** size type in rem from the scale above, so the phone's text size and browser zoom scale everything.

### Don't:
- **Don't** add borders to cards; paper is defined by the card shadow.
- **Don't** use uppercase tracked labels or eyebrows above headings.
- **Don't** put text on translucent glass without the mostly-opaque surface behind it.
- **Don't** show a competitor number as who someone is outside its competition.
- **Don't** add texture or gradient light outside the brand panel.
- **Don't** fade text with opacity to mean "done" or "out"; mute it by colour and add the words.
