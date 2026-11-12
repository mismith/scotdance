# ADR-0019: How ScotDance Entries and ScotDance.app fit together

Status: Implemented and deployed to ScotDance next and shared backend; legacy frontend preserved (2026-11-11)
Date: 2026-11-11

## Context

ScotDance Entries (`entries.scotdance.app`, Firebase project `scotdance-entries`, Firestore) lets parents enter
competitions and pay, and organisers receive entries and money by Stripe Connect. It signs in with ScotDance.app
(ADRs 0015 and 0017), and its pass already names the organisations a person is an admin of.

Four things were undecided: where a competition's details are typed, how an organisation is one thing on both,
who may run an organisation now that money follows it, and how dancers get from Entries into a competition here.

What was true when this was written:

- A competition here has no prices, entry form or rules, only `registrationURL`, `registrationStart` and
  `registrationEnd`. A dancer is a number in one age group; nothing records which dances they entered.
- Entries had a made-up competition (`devCompetition`) and "Not listed", which made an organisation of its own
  with no check of who the person is.
- `createOrganisation` has no review: anyone who manages a competition can make one under any name that isn't an
  exact duplicate, and an auto-approved submission makes anyone a competition's admin.

## Decisions

### 1. Every fact has one owner

- ScotDance.app owns people, organisations, admins, and a competition's name, date and venue.
- Entries owns entering and money: the form, prices, opening and closing dates, rules, orders, payouts.
- The other side shows a fact read-only, with a link to where it is edited. Nothing syncs both ways.
- The link is the same id on both sides, for competitions as for organisations.

### 2. A competition starts here

- Entries has no fields for name, date or venue. The organiser picks one of their competitions and Entries adds
  what it owns. Its record there has this competition's id.
- The `entries` pass also carries `competitions: [{ id, name, date }]`: the coming ones they manage.
- To link one, a person must be its admin here and an admin of the organisation in Entries. A competition can
  have several organisations here; in Entries it has one, the one that is paid. The organiser picks it.
- Entries keeps a copy of the name, date and venue (public data) and refreshes it when the organiser opens the
  competition and once a day. A paid order keeps its own copy.
- Entries sets `registrationURL`, `registrationStart` and `registrationEnd` here, through a callable that takes
  a pass signed by Entries' server (as `unlinkTool` does, the other way). Manage › Details then shows those three
  as "Managed in Entries". For a linked competition that takes registration from its primary (ADR 0007), it
  writes to the primary.
- An organiser with no competition here is sent to Add a competition with a return address, and lands back in
  Entries on it. The form is not copied into Entries. Drawing it in the embed's sheet is a later nicety.
- A submission that needs review (a new organisation always does) makes them wait once. The approval email
  links back to Entries.
- Entries has no draft state. A competition can be entered only between its opening and closing dates; with no
  dates it isn't open. It doesn't follow `listed`: an unlisted competition can take entries by its link.

### 3. Only ScotDance.app makes organisations

- Entries' "Not listed" becomes a link to make the organisation here; it then arrives in the pass. Entries'
  `addOrganisation` goes. Organisations Entries made by itself were test data.
- ScotDance.app owns the name, logo and admins. Entries owns payouts and the card fee setting.
- An organisation's Manage page here links to taking entries for it.
- Removing an admin here tells Entries at once (a trigger on `organisations:permissions/{id}/users/{uid}` posts
  a signed pass to Entries, which removes the member). Before this, a removed admin kept access in Entries until
  they next signed in.

### 4. Admins are trusted as they are, with two safeguards

- Nobody can settle who runs an association automatically: there is no registry to check. A "verified" tick
  that only Murray sets was considered and put off.
- ScotDance.app is the only place anyone becomes an admin. Entries never grants it.
- Before Stripe goes live, Entries emails Murray when an organisation finishes setting up payouts, saying who
  did it, and an organisation has a `paused` switch only he sets, which stops it taking entries.
- Known gap: a look-alike organisation could take money until that email is read. If it happens, add the tick:
  a field on the organisation that only system admins write, carried in the pass.

### 5. What a competition charges (Entries)

Taken from a real form (SHDA November 2026 on Eventry):

- **Items**: a name, a price, and optionally a category, steps and a member price. A dance is an item with a
  category and steps ("Fling [4]"). Choreography and workshops are items too.
- **Fees**: a name, an amount, and per dancer or per order (a flat fee, an association's levy). A per-order
  fee can be waived when the order has a second dancer ("$5 admission, waived when registering more than one").
- The second-dancer waiver is optional and configurable; competitions may leave it disabled. Dancer levies
  apply once per competition. Order charges, including the Stripe service fee, apply per order.
- Member pricing: a yes/no question on the form picks the member price, on trust.
- The organisers' own "online service fee" is Entries' card fee, shown as "Service fee". There is one, not two.
- Family caps are not built.

### 6. Dances come here once

- "Send dances to ScotDance.app" writes the dance items' names and steps to `competitions:data/{id}/dances`, only
  while it is empty. After that they are edited here (order, short names, which age groups dance them).
- Which dances each dancer entered stays in Entries. Nothing here needs it.

### 7. Parents, dancers and orders (Entries)

- A parent's account keeps their dancers (`users/{uid}/dancers/{id}`: first and last name, birthday, category,
  studio, registration number), readable only by them. Town, province and country are kept once, on the parent.
  They are not tied to dancer profiles here (ADR 0016: no claiming). Binder may sync with them later.
- An order is one payment for one or more dancers, each with their items. A parent can order again for the same
  competition. A dancer already entered can only add items they haven't entered, and the form shows what they
  already have as it is filled in.
- Refunds can be per dancer without cancelling anyone else's entry. Everything the parent paid is refundable,
  including shared fees, service fees and donations; a partial dancer refund must explicitly account for those amounts.

### 8. Dancers reach a competition through Splits

- After entries close, the organiser presses one button in Entries. It opens Splits and posts it the paid
  entries (the columns Splits already reads: names, category and age, town, province, country, when they
  entered), the competition's date and this competition's id. Splits checks the sender's origin, as the embed
  does.
- The organiser makes the age groups in Splits and sends them here as now (ADR 0015): the inbox, then Import
  dancers' preview. The competition is already chosen.
- Birthdays stay in Entries; Splits gets ages. Splits passes the studio through (Import dancers already reads it).
- Workshop-only purchasers are excluded from competitive age groups.

### 9. Implementation clarifications

- Conflicting shared registration settings are rejected with an explanation. Changing a linked primary keeps
  Entries ownership and its latest registration together; separating the source competition releases inherited locks.
- Trusted organisers retain the existing organisation-creation route. New organisations submitted with a
  competition require review before the return to Entries becomes available.
- Payout notifications use Postmark.
- Delivery uses committed worktrees and usable previews, without pull requests. Initial hosting uses
  `next.scotdance.app` for the updated source UI and embed, preserving the active legacy application.
- The source bridge, ownership rules, return journey and Splits destination flow are implemented and tested.
  [Integration contracts and release commands](../entries-integration.md) record the deployment sequence and
  repeatable emulator checks, deployed scope and live acceptance evidence.
- Ongoing publication belongs to a server-side Entries connection established by a currently authorised human,
  rather than whichever organiser last saved settings. Unlinking releases that binding; reconnecting creates a
  new one so an older queued job cannot recreate it.
- Deleting a ScotDance account deletes its private Entries profiles and birthdays. Paid entries remain entered:
  their roster keeps names, categories and ages at the competition, together with necessary financial records.
  Pending payments keep that minimal roster until reconciled. Signing out or unlinking a tool does not delete data.
  Distinct signed deletion delivery, retries and a permanent receiver tombstone prevent lost requests or replay.

## Consequences

- Here: `competitions` in the `entries` pass; a callable for the three registration fields and their read-only
  state in Manage › Details; a return address on Add a competition; the admin-removal trigger; a "Take entries"
  link on an organisation's Manage page.
- Entries: its competition and order shapes change (they were placeholders), `addOrganisation` goes,
  `startCheckout` refuses a paused organisation or a competition that isn't open, and it gains saved dancers,
  the payouts email and the hand-off to Splits.
- Splits: a listener for the hand-off, and the studio column.
- Build order, each shippable alone:
  1. The pass carries `competitions`.
  2. "Not listed" becomes a link here.
  3. The payouts email and `paused` (before Stripe goes live).
  4. Picking a competition in Entries, and its real record (items, fees, member prices, dates).
  5. The registration callable and "Managed in Entries".
  6. The entry form: saved dancers, several dancers in one order, ordering again (mocked first).
  7. Send dances here.
  8. The hand-off to Splits.
  9. Admin removal reaches Entries at once.
