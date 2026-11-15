# ScotDance Connect plan

Status: Private Connect preview implementation started, 15 November 2026. See `scotdance-connect/README.md` for verified implementation scope (the sibling repository).

Connect is a private family address book shared across ScotDance apps. Parents or dancers enter their details once in Connect or Entries, keep control of them, and explicitly share selected fields with a studio. It is not a public dancer directory or a universal identity-verification system.

## Decisions

- Connect provides sign-in, account settings and My dancers at connect.scotdance.app, with the same profile forms available in Entries.
- Reuse the existing ScotDance Firebase Authentication project, users, passwords and UIDs. Moving responsibility and screens to Connect does not require moving accounts between projects. An optional project display-name change is cosmetic, not a migration.
- Keep shared private dancer profiles in the separate scotdance-connect Firebase project, using Firestore with explicit access checks. Existing Firebase Auth stays in firebase-scotdance. Leave ScotDance.app’s live public results and Realtime Database intact.
- Parents/dancers control shared profile data. Binder reads selected fields through an explicit ongoing sharing grant. Teachers propose corrections; the profile manager approves them.
- Binder and Entries can be redesigned directly before launch. No backwards compatibility, existing-record migration, dual writes or legacy mapping framework. Real source data can be imported afresh when needed.
- No automatic matching, public profile claiming, provisional central profiles or cross-account merging in v1.
- Defer AI/MCP access to the shared family profiles. Connecting an existing studio assistant must not silently extend its access to Connect.
- The user authorised implementation and launch in this chat. No existing app data deletion or directory-submission changes are part of this work.

## Small initial data model

| Record | Contents |
| --- | --- |
| Account | Existing Auth UID and verified sign-in email; account-owned contact details. |
| Dancer | Opaque permanent dancerId, managing account, name, birthday, revision and only additional fields a current workflow needs. A child needs no login. |
| Studio share | Dancer, studio, approved field set, approving account, creation time and active/revoked state. |
| Correction proposal | Dancer, proposed field changes, teacher/studio, base revision and approval/rejection. |
| Change history | Who changed which fields, through which app, and when; private and with a defined retention period. |

Start with one managing account per dancer; an adult may manage their own profile or several children. The account-to-dancer relationship should allow explicit additional managers later, without implementing household graphs, self-claiming or guardian-transition workflows now. No automatic access based on a surname, birthday, card number or matching email.

Profile creation establishes management of that newly created private record; it does not claim another person’s existing records or certify legal guardianship. Verify the account email before sharing. Do not require identity documents for ordinary profile creation.

Registration details can initially be self-declared fields with their source clearly recorded. Future issued credentials are separate issuer-controlled records associated with dancerId; typing a number never makes it verified.

## Account architecture

Connect owns the account experience and shared-profile API. The existing Firebase Auth service remains the identity provider for all apps. Reuse existing sign-in credentials and account IDs rather than exporting/importing accounts or maintaining another Auth user pool.

Build a small TypeScript API, Vue portal, shared API/types package and reusable profile forms. Use Firebase Hosting/functions in scotdance-connect with a scoped API and read-only verification of existing Firebase Auth identities. Confirm database location and access rules before provisioning. Existing app-local authentication needed for specialised stores can remain an implementation detail; all Connect calls must authenticate the actual ScotDance account and enforce its permissions.

Sign-in redirects and shared components must work without third-party iframe cookies. A calling app cannot impersonate someone merely by supplying their UID. A studio’s membership roles alone cannot grant access to private Connect profiles.

## Parent and dancer experience

1. Sign in to Entries or Connect with the same ScotDance account.
2. Open My dancers, select an existing dancer or add one.
3. Edit shared details through the same form in either app. The save updates one record; there is no sync-back job.
4. Entries uses the selected profile when preparing an entry, asking only for event-specific or missing information.
5. Connect shows which studios receive which fields and lets the manager stop sharing.

ScotDance.app’s public name-derived results profiles remain separate. They do not establish account ownership, and creating a private dancer profile does not publish it or alter existing results.

## Binder signup and connected sharing

The teacher sends a studio signup form. It offers “Use my ScotDance details.”

1. The parent signs in and selects a dancer from My dancers, creating one if needed.
2. The form shows the exact fields requested and explains that the studio will receive current values while sharing remains active.
3. The parent approves “Share these details with this studio.” This creates a specific field-limited grant, not access to the whole family account.
4. Binder links its local roster record to dancerId. It reads the approved fields from Connect; local caches are disposable, not independently editable copies.
5. Later parent edits become available to Binder through the same grant. Parent contact fields require their own explicit inclusion; selecting a dancer does not share all account details.
6. Teachers edit studio-owned information normally. A shared identity/contact correction becomes a proposal for the profile manager, who accepts or rejects it.

A private signup invitation must be unguessable, expiring and bound to the intended recipient/context. A general studio signup link may be reusable but carries no existing dancer’s private data or access rights. In both cases, selecting and sharing a profile requires its manager’s authenticated approval. A studio invitation never grants the recipient access to somebody else’s Connect profile.

### Families without Connect

Keep manual studio signup and fresh imports available. These create ordinary local Binder roster records, not central profiles owned by a teacher.

The parent can later use a specific studio signup/link invitation, select their own Connect dancer and approve sharing. Binder attaches the reference to its local record. Parent-approved shared values then supply the selected fields; differences are shown before connecting. Local classes, notes and history stay attached to the Binder record.

No background name/email matching or automatic central-profile creation. Repeat imports update local studio fields; they cannot overwrite parent-owned shared fields. This is a normal future signup feature, not an existing-data migration project.

## Data boundaries and privacy

- Connect holds the minimum genuinely shared current details. Add fields only when a concrete consumer needs them.
- Binder keeps classes, teaching notes, goals, measurements, medals and wardrobe information private to the studio. Linking does not put these into the family profile or expose another studio’s records.
- Entries retains an order’s submitted snapshot and profile revision. Later profile edits do not rewrite completed entries, consent receipts or payment records.
- Studios receive only approved fields. Organisers receive the information submitted for their event, not general ongoing access to a family profile.
- Revoking a share stops future reads and invalidates shared-profile caches. Binder must not silently turn a revoked connected profile into an ongoing local mirror. Identify any submitted/historical records retained separately and explain that scope to the family.
- Profile/account deletion and retention of orders or studio history are separate operations with explicit rules. Do not promise that stopping sharing erases information already legitimately received.
- No central public search, lookup by birthday/card number, or exposure through public results, logs or analytics.
- Existing Binder MCP handlers must not inherit newly connected family fields automatically. Keep those fields out of assistant responses until a separate explicit permission design is approved.

Central storage reduces repeated collection but increases the consequence of a breach. Keep the central dataset small, permissions narrow and access checked server-side on each request.

## Essential implementation rules

Use stable IDs, field allowlists, expected revisions and idempotent mutations. Record edits and approved corrections atomically with private change history. A stale proposal cannot overwrite a newer parent edit without review.

Shared data remains authoritative in Connect. Refresh on saves and when forms/views reopen; invalidate caches on grant revocation. If Connect is unavailable, do not pretend a shared edit succeeded or create a new writable copy. Local studio work and already-submitted orders remain independent.

Before final checkout, revalidate profile-sensitive prices and eligibility. A changed birthday/category requires a refreshed quote. Historical snapshots are intentional business records, not a second current profile.

## Card issuance later

The future card app will mint cards. The parent selects the existing Connect dancer, applies and supplies only missing/application-specific information. An authorised issuer approves and creates a credential for that dancerId, including issuer, season, number, category and status. Renewals retain the same dancer identity.

Until issuance exists, allow self-declared card details without blocking Connect’s launch. Do not implement a separate identity-document or external-card-verification platform now. Issued credentials verify only what the issuer actually checked; they do not automatically establish guardianship. Issuer-controlled fields cannot be overwritten through parent forms.

## Build order

1. Confirm the minimal profile fields and consumer access matrix; specify the existing-Auth sign-in flow and private API.
2. Build Connect My dancers and account screens with shared forms, profile permissions, deletion and edit history.
3. Replace Entries’ saved-dancer copies with Connect references. Verify that creating/editing a dancer in either UI is reflected in the other. No legacy compatibility layer.
4. Add Binder’s explicit signup sharing, optional local roster linkage, revocation and correction proposals. Keep manual/local roster use working.
5. Build card registration/issuance using the same profiles when that app is ready.
6. Revisit unified MCP access separately; do not make it a dependency for family-profile launch.

## Acceptance checks

- Existing ScotDance login still works; no account/password migration or duplicate central Auth user.
- Create once and edit from Connect or Entries; unrelated accounts cannot read or edit the dancer.
- Studio signup receives only approved fields; connected values update after parent edits.
- Manual/imported Binder records remain local until explicit parent linking; no automatic identity matching.
- Teachers propose shared changes and directly edit only local studio fields; stale proposals are rejected for review.
- Revoked sharing blocks reads, invalidates caches and does not leak through Binder MCP.
- Namesakes/twins stay separate; reused card numbers and matching emails never grant access.
- Completed orders retain submitted details; changed profile-sensitive fields invalidate pending quotes.
- Public ScotDance results and search do not gain private data or change as a side effect.

## Remaining bounded decisions

- Exact initial profile fields, contact sharing and studio field bundle.
- Retention/deletion rules and the explanation shown when sharing stops.
- Additional managers and younger dancers’ own account access, when needed; not an automatic claiming system.
- Issuer-specific credential rules when the card app is implemented.

## Source context

- [Existing ScotDance sign-in](../functions/src/toolPass.ts).
- [Binder records](../../scotdance-binder/src/data/types.ts).
- [Entries profile-copy logic to replace](../../scotdance-entries/functions/src/binder.ts) and [order snapshots](../../scotdance-entries/functions/src/order.ts).
- [Public results profile design](adr/0016-dancer-profile.md).
