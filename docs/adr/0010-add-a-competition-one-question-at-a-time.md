# ADR-0010: Add a competition, one question at a time

Status: Accepted
Date: 2026-10-11

## Context

Submitting a competition had an overview, then four steps: Details, Venue,
Contact and Review. Each step asked several things, and optional fields sat
behind "+ Add …" buttons.

Mocking ADR 0009's suggestions into that form made it worse. Murray
(2026-10-11): "super complicated and confusing. People will get lost very
easily."

Instead, ask one question at a time, like Typeform and other modern forms:

- Defaults are chosen for you.
- Every slide has one button.
- Skipping is plain to see.

The same day, Murray made it **Add**, not Submit, everywhere organisers see
it.

## Decisions

### 1. The slides

| #   | Slide                                            | Button                                       |
| --- | ------------------------------------------------ | -------------------------------------------- |
| 0   | Intro                                            | **Start** (signed out: **Sign in to start**) |
| 1   | **Which country is it in?**                      | Continue                                     |
| 2   | **When is it?**                                  | Continue                                     |
| 3   | **Is it one of these?** (ADR 0009, when matched) | **None of these** / Continue                 |
| 4   | **What's it called?**                            | Continue                                     |
| 5   | **Who's running it?**                            | Skip / Continue                              |
| 6   | **Where is it?**                                 | Continue                                     |
| 7   | **What's its registration number?**              | Skip / Continue                              |
| 8   | **What's your name?**                            | Continue                                     |
| 9   | **All good?**                                    | **Send**                                     |
| 10  | Sent                                             | **Back to competitions**, plus "Add another" |

- Picking a match on slide 3 jumps straight to slide 9, with everything
  filled in. A returning organiser is done in four taps: country, date,
  "Same again", Send.
- **Description is no longer asked.** Organisers add it in Manage ›
  Details, along with the logo.
- Slide 3 comes with ADR 0009. Until then the progress counts 8 steps.

### 2. Every slide

- **The question, at Display size,** as the page's title. Under it, one
  helper line. Then the control.
- **One button, always in the same place at the foot.** Enter presses it.
  It stays pinned there while a long slide (All good?) scrolls.
  - Most slides have to be answered. Their button is always **Continue**.
    Pressing it on an empty slide puts a line under the field, e.g. "Pick a
    date to continue."
  - **Optional** slides show a tonal **Skip** while empty, which turns into
    the primary **Continue** once something's in. Nothing is ever labelled
    "(required)": a slide that never offers Skip says it.
- **Nothing moves on without a tap,** even after choosing one option. It's
  easier to predict than Typeform's moving on by itself.
- **Getting around:**
  - The app bar's back button goes to the previous slide. On the intro, it
    leaves.
  - While changing an answer from All good?, back and the button both return
    there.
  - The phone's own back (Android, or the browser's) leaves the page. The
    draft keeps everything (see below).
  - A thin progress bar in the app bar replaces the four labelled steps.
  - The tab bar hides while answering, as it does inside a competition.
- **Motion and focus:**
  - The existing step transition: slides move the way you're going.
  - Once a slide is in, its question has focus, for screen readers. With a
    mouse and keyboard, the box to type in has it instead.
  - A slide on its way out can't be typed into.
  - Reduce Motion just changes the slide.
- **Drafts** save as you go, kept per account. The intro then offers **Pick
  up where you left off**, which returns to the slide you were on, and "Start
  over".

### 3. Copy and defaults

- **0 Intro:** "Add your competition", "Free, and about 2 minutes."
  - Three stops: _The competition_ (when, where and what it's called),
    _You_ (your name, so replies reach you), _Approved_ (usually overnight,
    then an email with a link to add the rest, like dancers and the
    schedule).
  - "What you'll need" opens the old overview's list in a sheet.
- **1 Country:** Australia, Canada, England, New Zealand, Scotland, South
  Africa and the United States, A to Z. "Another country" searches the
  rest, Wales and Northern Ireland included.
  - It starts on the country chosen on Competitions, otherwise the phone's.
  - The UK's nations are their own choices. One starts selected only when
    Competitions already says which; otherwise none does.
  - A nation is sent the way the venue search would put it: the UK's code
    with the nation as the region.
- **2 Date:** "If it runs over a few days, pick the first." An inline month
  in the calendar's grid, with the day chosen written out underneath.
- **4 Name:** "As dancers and families will see it." The example in the
  empty field depends on the country.
- **5 Organisation:** "An association, games society or series. Its page
  lists everything it runs."
  - On first arrival, any organisation the name mentions is already ticked,
    or the only one you manage. The rest of yours are offered unticked.
  - "Find or add an organisation" opens the existing picker.
- **6 Venue:** "Search for the venue. If it isn't booked yet, the town is
  enough."
  - The search only looks in the chosen country.
  - A picked venue shows as a card (venue, address, town) with "Change".
  - "Just the town for now" asks for only the town.
  - "Type it in" asks for the venue's name, address and town. It's the one
    slide with several fields.
  - A venue typed into the search and not picked is kept as typed, and the
    town is asked for.
- **7 Registration number:** "From ScotDance Canada. If you don't have it
  handy, add it later." The empty field shows an example, e.g.
  C-AB-CO-27-1234. Both depend on the country: ScotDance USA, the ABHDI or
  your state's committee, otherwise the RSOBHD with no example.
  - **As it's typed,** it shows how the number will be saved. The server
    tidies every number into its association's format, and the app uses a
    copy of that code, so "c ab co 27 1234" shows "Registered with ScotDance
    Canada: C-AB-CO-27-1234".
  - **A number it can't read gets one "are you sure?".** The first Continue
    stays put: "That doesn't match the usual format, like C-AB-CO-27-1234.
    Check it, or continue anyway: it'll get a look before it's approved."
    The button then reads **Continue anyway**.
  - It never blocks. A new or unusual format still gets through, and
    review already holds an unreadable one for a person to look at.
- **8 Your name:** "So replies reach the right person. It's never shown
  publicly." It starts with your account's name.
- **10 Sent:** "Thanks. It's usually approved overnight…", as before. "Add
  another" starts on the date, keeping the country, venue, organisations and
  you.

### 4. All good?

- **"Tap anything to change it."** Each answer is a row with its label,
  the answer (wrapped, never cut short) and a chevron. "Not added" stands
  in for an optional one skipped. Your name's row shows your email too.
- **Message:** a plain field under the answers, "Anything to ask or
  mention?", with "Only the reviewer sees it." It's not an "Add a message"
  button.
  - Anyone who misses it can reply to the received email.
  - Both admin emails show it.
- **The as-is checkbox stays,** with its current words.
- **Send** checks every answer first. One gone missing (a draft from
  before, say) opens its slide, with its button reading Back to review.

### 5. Add, not Submit

The intro, the app bar, the page title, More, the sidebar, About, Manage's
empty list, Competitions' "Running a competition?" button (**Add it**) and
the sign-in sheet all say Add.

- **The address is `/competitions/add`.** The old `/competitions/submit`
  redirects to it, for emails and links from before.
- **One thing doesn't change:** Submissions keep their name in System admin,
  where it's the established term.

### 6. Emails

- **Received:** "Thanks for adding …" (the subject too).
  - "Within a week" contradicted the app, which says "usually approved
    overnight". It now says "You'll get another email when it's approved,
    usually overnight."
  - The fine print says "add" too.
- **Approved:** "Where to start" step 1 becomes "Details: a description, a
  logo or photo, and a link to registration". The fine print says "add".

## Considered

- **Moving on after a single choice,** as Typeform does. Set aside so the
  button means the same thing on every slide.
- **The message as its own slide.** A slide everyone skips. Set aside for
  the field on All good?
- **A line under Send instead of the checkbox.** Murray kept the checkbox.
- **Signing in at the end,** so more people get started. Drafts are saved
  per account, and an account comes before anything else today.
- **The country as a chip beside the date** (ADR 0009's first draft). It
  became its own slide, since it shapes everything after it: the matches,
  the venue search and the registration number's example.
- **The countries in order of how many competitions each has.** A to Z
  reads as neutral, and with the right one usually already selected, the
  order matters little.
- **A history entry per slide,** so the phone's back steps back a question.
  It would turn every slide into a page change, with the app's page
  transitions. Leaving with the draft kept is simpler.

## Consequences

- `Submit.vue` is rebuilt as slides:
  - `SubmitIntro` replaces `SubmitOverview`.
  - `CountryPicker`, `DayPicker` and `VenueStep` are new, in
    `components/submit`.
  - `StepNav` goes, replaced by the progress bar.
- **Registration numbers:** `web/src/lib/registration.ts` gains a copy of
  `tidyRegistration`. `registrationMirror.test.ts` checks it against every
  number in the server's own tests, so the two stay in step.
- **Other changes:**
  - `AppBar` gains a `middle` slot, for the progress bar.
  - The route owns its bottom bar (`ownsBottomNav`).
  - `fetchVenueSuggestions` and `VenueField` take region codes.
- **Old drafts:** the fields map across, and the intro picks up at the
  first question.
- **The submission's shape barely changes.** `description` no longer goes,
  and `country` (plus `region` for a UK nation) goes when the venue wasn't
  picked from the search. Nothing changes in functions or rules.
- **Specs:**
  - The e2e and unit specs are rewritten.
  - `e2e/support/submit.ts` walks the slides for any spec that sends one.
- **Emails:** the two Postmark templates are updated. Merging to `next`
  pushes them.

## Build order

1. The slides with today's fields, without slide 3.
2. The two emails.
3. ADR 0009: slide 3, and the sent screen's "Another competition that
   weekend?".
