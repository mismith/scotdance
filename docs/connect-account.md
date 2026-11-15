# Account editing in Connect

Connect owns the account screen. `/account.html` is a small identity-origin entry point embedding the extracted name/email/password/deletion form. Connect frames it from `next.scotdance.app`; passwords stay on that established sign-in origin. It uses the original Auth store and private account records, preserving older names and account IDs. This is a UI move, not a data/password migration.

The frame validates both its actual parent window and exact `https://connect.scotdance.app` origin, then matches the requested owner to its signed-in UID. CSP permits only that parent. Connect validates the source frame and exact identity origin. Fresh tokens on successful edits renew Connect's existing session; other apps never receive these tokens.

`Profile.vue` now links to Connect while retaining competition roles, tools and assistant settings. The older production app has the same account link on the separate `main` branch. Never deploy the next build over the legacy production site as part of this change.

The existing `entriesAccountDeleted` Auth hook also calls Connect's service-only deletion route. It retries failures. Connect independently confirms Auth user absence, marks the UID to block in-flight writes, recursively removes private account data, and revokes sessions. The marker expires after 90 days. No anonymous/browser-selected account deletion is accepted.

Entries is a first-party interface to the same account. Signing in permits the owner to manage their dancers without a connection/consent screen. Explicit grants remain appropriate for studios and other people.

Validation: 13 account/handoff protocol tests; type checks/build; live account name save/reload/restore and incorrect-password rejection; temporary-account Auth deletion erased its Connect profile. Existing reviewer credentials were not changed. Email delivery and real-phone autofill remain untested.

Deploy: build `web`, deploy `hosting:next`; deploy `functions:auth-hooks` for deletion delivery. Connect has its own repository and deploy command. Production legacy account-page rollback is preserved in Hosting channel `before-connect-account` (verified against the prior live index). Existing competition data is untouched.
