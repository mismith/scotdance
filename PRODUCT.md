# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A Vue 3 web app at scotdance.app, also shipped in the App Store and Google Play inside a Capacitor shell. The shell doesn't make it native: one web design language everywhere, with system conventions where the shell needs them (safe areas, haptics, Face ID through password AutoFill).

## Users

- **Parents and families (primary).** At Highland dance competitions, following their own dancers: when and where they dance next, and how they placed. Grandparents and less techy relatives are common. When their needs conflict with anyone else's, theirs win.
- **Dancers.** Their own schedule and results, without the paper.
- **Teachers.** Following a whole studio at once.
- **Organisers and their admins.** Set up a competition (details, staff, dances, age groups, dancers, platforms, schedule) and enter results on the day. Manage follows the same design system but may be denser.
- **System admin.** One person (the maintainer): users, submissions, rebuild tools.

## Product Purpose

Highland dance competitions run on paper: printed programs, schedules on a wall, results read out and posted later as PDFs. ScotDance.app puts the program, schedule and results on everyone's phone, live as they're announced, and keeps every result on record afterwards. For organisers it saves hours of work and paper.

Success: a family at a competition can find their dancer, see when they're on next and watch placings arrive, without asking anyone; an organiser can run the day's results from a laptop or a phone without errors.

## Positioning

Built by a Highland dance family, for Highland dance families. Free for attendees and organisers anywhere in the world, with no plan for that to change. Independent: not affiliated with any association, governing body or competition. Volunteer-run by one person, not a company.

## Operating Context

- Phones at the venue: outdoor Highland games in bright sun and wind, loud indoor halls. Often one-handed, glanced at between dances, on patchy signal.
- Organisers mostly on a laptop at a table; sometimes on a phone in the audience. One volunteer often does all the data entry.
- A competition day has platforms, age groups and dances running in parallel; results come in dance by dance (callbacks, then placings), sometimes days after for multi-day events.
- The app works in any browser; the store apps are optional, mainly a home-screen shortcut.

## Capabilities and Constraints

- Public: competitions (list, calendar, map), a competition's overview, dancers, schedule and results; search by name or competitor number; profiles for dancers, judges, pipers and venues; follow dancers (with colours), judges and competitions; live alerts.
- Accounts: email and password only (no Apple, Google or magic-link sign-in).
- Manage (in the same app): every section of setting up a competition, in setup order (Details, Staff, Dances, Categories, Age groups, Dancers, Platforms, Schedule, Results); admins and invites; visibility (Private, Listed, Published).
- Results entry is tap-to-pick, mirroring the old admin's mechanism (dance list per group, Placings/Points, Championship and how many places, tie switches, tap a placed row to remove). It keeps the "?" stand-in dancer so organisers can carry on and fix later. Never an on-screen keypad. A previous redesign of it was rejected as confusing and error-prone.
- No offline writes: Manage edits need a connection.
- Terminology: always "competition" (never "comp"); established admin labels stay accurate ("Users", "Staff", "Admins").
- Competition data is user-submitted; the repo is public.

## Brand Commitments

- Name: ScotDance.app.
- Scott: the humanised logo dancer, the brand's character, used in brand assets.
- Voice: friendly, plain, a little conversational, in the maintainer's own words. Never condescending to parents or organisers. No "we/us/our" (there is no team). Em dashes sparingly and unspaced.

## Evidence on Hand

- Real competitions and results since 2018 (production data); an anonymised copy for tests at `web/e2e/seed/`.
- Store listings for iOS and Android.
- No testimonials, user counts or press to quote: don't invent any.

## Product Principles

1. Families first: the next thing a parent needs is on screen without hunting.
2. Glanceable in the worst conditions: sunlight, noise, one hand, older eyes, bad signal.
3. Accurate over clever: results and schedules must be unambiguous; never guess on someone's behalf.
4. Quiet, independent and free: no upsell, no growth tricks, nothing that treats families as a market.
5. Organisers' time is precious: fewer steps, forgiving mistakes, nothing lost.

## Accessibility & Inclusion

Large, high-contrast text and targets for older relatives and outdoor glare; Reduce Motion honoured throughout; screen-reader labels on icon-only controls; works at small phone widths (360px) and in both light and dark.
