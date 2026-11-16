# Account editing in Connect

Connect renders the shared Vue account form directly in `/account`. Account is the first tab and Dancers the second. The editable name sits beside the avatar, with the Gravatar notice underneath. Email, password and deletion dialogs belong to the top-level page, so their backdrop and layout cover the full viewport.

Only sign-in uses the existing embedded identity-origin form at `next.scotdance.app`. Signed-out visits to protected routes open it automatically. Public privacy/support pages do not. This preserves the established login origin; account editing does not require an iframe. Actual password-manager autofill still depends on the browser and has not been tested on a real phone.

`src/account/AccountForm.vue` reuses the shared Avatar and Dialog components. `src/account/firebase-settings.ts` adapts Firebase's user-scoped REST APIs to the form. It takes the existing handoff ID token, validates its UID against the Connect session owner before reading private records, and retains it only in memory. Passwords go directly from the browser to Firebase; they never pass through the Connect API. Sensitive edits reauthenticate, cannot switch owners, and renew the Connect cookie with the returned token. Existing private account names, account IDs and passwords are preserved.

`Profile.vue` links to Connect while retaining competition roles, tools and assistant settings. The older production app has the same account link on the separate `main` branch. Never deploy the next build over the legacy production site. The retired `/account.html` entry is no longer built. `/account-test.html` is an emulator-only fixture, omitted from production inputs.

Deletion follows the existing private-record cleanup and Firebase Auth deletion flow. The retried `entriesAccountDeleted` Auth hook calls Connect's service-only deletion route. Connect independently confirms Auth user absence, blocks in-flight writes, recursively removes private account data, and revokes sessions. No browser-selected account deletion is accepted by that service route.

Entries is a first-party interface to the same account. Signing in permits the owner to manage their dancers without a separate connection/consent screen. Explicit grants remain appropriate for studios and other people.

## Validation

- Nineteen account-adapter and sign-in protocol unit tests cover owner binding, reauthentication, credentials, deletion scope and disposal.
- Desktop and phone browser checks cover tab order, avatar notice and all three dialogs without an account iframe.
- A live disposable identity passed name save/reload, email change, password change/new-password sign-in and deletion through the native UI. Reviewer credentials were unchanged.
- Existing account/sign-in emulator tests exercise the shared form separately from production identity services.
- Both frontend builds include type checking. Email delivery and real-phone autofill remain untested.

## Shared frontend and deployment

Connect lives in `web/src/portal`, alongside the competition app, importing its Button, SidebarLink, EmptyState, LogoMark, Avatar, Dialog, theme and field styles. Routes are `/account`, `/dancers`, `/dancers/new`, `/dancers/:id`, `/privacy` and `/support`; old query links redirect to clean routes. The footer contains only privacy and support. Crisp shares `src/lib/crisp.ts`.

`npm --prefix web run dev:connect` starts a standalone local site with no production API proxy. Use fictional browser fixtures. `npm run deploy:connect` builds and deploys only Connect Hosting via `firebase.connect.json`. Publish Connect before retiring the old identity-origin account entry with `npm --prefix web run build` and `firebase deploy --only hosting:next --project firebase-scotdance`. Do not deploy Hosting production or backend functions for this UI change.

The separate Connect repository owns API/rules deployment, which does not include Hosting. No identity migration, IAM changes or private-data boundary changes are part of this release.

## Supported sign-in copy

Production Firebase Auth audit on 15 November 2026 found 5,311 accounts, all with password credentials and hashes, and no Apple/Google providers or passwordless accounts. Account copy therefore describes current passwords and password reset links only. The old beta-account comments and synthetic password-setup UI/test were removed. Internal credential-provider checks remain defensive; they are not evidence of production account types.
