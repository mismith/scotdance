---
version: 1
slug: "web-src-views-home-vue"
primary_target: "web/src/views/Home.vue"
related_targets: ["web/src/views/competition/Dancer.vue","web/src/views/competition/Info.vue","web/src/components/DancerDayCard.vue"]
---

Scope: the public competition-day surfaces (Home, a competition's Overview, a competition dancer page). Visitor mode: Operate. Parents and relatives at the venue, phone in one hand, glancing between dances.

## Direction contract

THESIS: The bib your dancer wears is the hero object. Each followed dancer appears as their pinned number card at size, with placings pinned beside it as rosettes. Refuses the list-row card where a dancer is a name in a row of dance rows.

OWN-WORLD: Mist ground, paper cards at 20px continuous corners, one Saltire blue for actions only. Dancer colours live on the bib's band (and nowhere else on the card). Placings are rosettes in rosette blue at 48px, pinned in a row; schedule facts right-aligned in tabular figures. Atkinson Hyperlegible Next at a bigger display scale: 32px greeting, 21px competition title, 20px dancer names.

STORY: A parent opens Home and sees each dancer as the bib they'd recognise at the platform, results pinned on as they come in, and the next thing the schedule says at the card's foot. Tapping goes to the dancer's own page, led by their bib at poster scale and every dance listed.

FIRST VIEWPORT: Home on competition day: greeting and date, then the competition (title, pink live line), then one card per dancer: bib 88px wide beside name and age group, a row of 48px rosettes (and a "Results to come" chip) across the card, upcoming dances at the foot with time, platform and draw right-aligned. Dancer page: back chevron and the competition's name, the bib 176px wide centred with its pins, name, age group, Following, then the day's list with rosettes on the right.

FORM: The Number Card, position 1 of the ordered list (the pick), seed key 2415a0e4.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Whether the dancer profile (outside a competition) adopts the same hero later.
- The store slides need regenerating once this ships (slot 3's Next chip no longer matches the app).
