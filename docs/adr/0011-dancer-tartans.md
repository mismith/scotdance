# ADR-0011: A tartan for every dancer you follow

Status: Accepted
Date: 2026-10-12

## Context

Each dancer you follow wears a colour across your app: their number card's
band, their avatar, the bar on their rows. You can pick it from nine, or any
colour at all.

Real tartans were tried in September (the `claude/tartans-parked` branch):
62 registered setts, a threadcount editor and crowd-agreed tartans per
dancer. They were pulled from the app: verifying whose tartan is whose was
too much for one volunteer, and bulk tartan data has unclear licensing.

In October Murray asked for something simpler: plaid designs, not
registered tartans, chosen by each follower just for them. Four rounds of
mockups settled the shape.

## Decisions

### 1. What a tartan is

- **A recipe, never a picture.** A sett in the Scottish Register's
  threadcount notation, the stripes from the middle out, e.g.
  `P40 K16 S16 K2 T2`. It's mirrored like nearly every tartan, and woven the
  same across and down.
- **Each letter is a colour.** K and W are a fixed black and white; any
  other capital is whatever colour the recipe gives it, so a tartan has as
  many colours as it needs. A real threadcount has the same shape with its
  own colour letters, so one could be drawn by the same code one day.
- **Four widths, like Lego:** Line, Stripe, Band and Field (2, 6, 16 and 40
  threads), up to 14 stripes. Pieces swap for another size; they never
  stretch.
- **Presets come in the dancer's colour and a pair that goes with it**, the
  way real tartans pair them (red with navy and yellow, gold with black and
  red). Picking a new dot weaves a preset again in it; on a tartan of their
  own it repaints the stripes in the old colour.
- **The dancer's colour follows the cloth.** Once no stripe wears it, it
  becomes the colour that replaced it (or the one woven most), so the dots
  everywhere still match.

### 2. Where it's kept

- In the same per-follower slot as the colour:
  `users:dancerColors/{uid}/{dancerId}` holds a colour (`'dancer-3'`,
  `'#rrggbb'`) or `{ color, sett, colors }`, `colors` giving each letter
  but K and W its hex (left out for one in black and white alone). Private
  to you, as colours are.
- The first build's `{ color, sett, second?, third? }`, with P, S and T as
  roles, only ever reached testers' phones, so it isn't read or accepted.
- The rules check the shape: the sett must be one the builder could make,
  colours must be palette ids or hex, and nothing else is allowed.
- An older build ignores a tartan it can't read and hands that dancer a
  colour, as it does any unknown value.

### 3. Choosing one

- **On the thing that wears it.** A palette badge on the dancer's avatar
  (their page) or number card (a competition's dancer page) opens a small
  picker: the colour dots, then the patterns woven in that colour (Plain and
  nine presets named after dances, not clans), then **Customise**.
- **Following is a plain toggle.** It no longer opens a menu; stopping shows
  **Undo**, and the look is kept for if you follow again.
- **Customise opens the loom.** Bricks along the top, the cloth below. Tap
  a brick or a stripe on the cloth to change its width, move it, remove it,
  or paint it: Black, White, any of the swatches (the nine dancer colours,
  yellow and sky) or any colour from the rainbow. There's no separate
  palette: testers lost track of which of First, Second and Third a stripe
  was. Drag bricks to reorder; + adds one. Every change saves at once, as
  the dots do; **Undo** steps back through the visit. **Ideas** offers
  eight remixes, which stay put until **More ideas**. **Undo** sits in the
  header, in reach wherever you've scrolled.
- **It closes like any sheet:** the X, a pull down or a tap outside. Testers
  found it closing on its own; a tap outside now only counts if the press
  began outside too, for every dialog (one let go off the edge, mid-drag,
  used to count).
- **Opening it changes nothing.** On a plain colour it shows the first
  pattern woven in it, but the dancer stays plain until the first change,
  and Undo can take them back.

### 4. How it's drawn

- Woven on a canvas: weft, then warp at half strength, then a fine twill
  rib. It's dyed in the light theme's palette in both themes (cloth doesn't
  change in the dark).
- Every look is cut from cloth of one scale (about 0.3px a thread, 16–200px a
  repeat), so a band, an avatar and a bar look cut from one bolt, and even a
  40px avatar shows a whole repeat rather than a corner of one.
- Each dancer's tartan is one `--cloth-…` rule (the image, its first colour,
  and the ink and halo for text on it), updated in place when it changes.
  Rows carry only `var(--cloth-…)`, never the data URL. Dots too small for
  cloth show the first colour; the pins take the band's ink.

### 5. Alongside

- **Gold is a true gold** (`#b5800a`) rather than the dark mustard that
  carried white text. It still holds 3:1 as a dot or bar on the page; text
  on it in the light theme takes ink (`--on-dancer-4`).
- **The number card's safety pins are quieter:** one thin, soft stroke and
  an open clasp, so the dancer's look is the star.

## Consequences

- One rail, same across and down. Letting the two differ would add a second
  rail and a `weft` field. It can come later without changing saved looks.
- The rules change needs deploying before anyone can save a tartan, and
  again for the `colors` shape (until then, every change on the loom fails
  to save).
- Looks stay per follower. Tartans that belong to a dancer, seen by everyone,
  remain the separate idea parked in September.
