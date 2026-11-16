# scotdance-web

- **Styling**: Tailwind utilities only. No custom classes with raw CSS rules. For descendant styling, use arbitrary variants on the parent (`[&_:is(strong,em)]:text-foreground`) rather than a wrapper class with child selectors. `<style>` blocks are reserved for things Tailwind can't reach: `html`/`body`/pseudo-elements (`::before`, `::after`), or third-party DOM created in JS (e.g. MapLibre nodes); even then, prefer `@apply` over hand-written declarations.
- **Icon-only buttons**: `rounded-full`, ≥44×44 (`size-11`); shrink to `size-9` inside nav-action chrome and `size-7` inside form inputs.
- **Copy rules**:
  - Never abbreviate to "comp" / "comps" in user-facing copy. Always "competition" / "competitions". Code identifiers (e.g. `CompChip`, `comp-` CSS classes) are fine.
  - Em dashes: use sparingly. Prefer period, comma, or colon. When kept, no spaces: `word—word`, not `word — word`.
  - No first-person plural ("we" / "us" / "our") in user-facing copy. The project is volunteer-run by one person — "we" implies a team that doesn't exist. Rephrase neutrally or use imperative voice.

## Connect frontend

`src/portal` is Connect's frontend, built separately with `npm run build:connect` and served locally with `npm run dev:connect` on port 5290. It directly imports this app's components, Tailwind styles and theme; do not fork another design system. Its small CSS entry lists the shared components Tailwind must scan outside the separate Vite root.

From the repository root, `npm run deploy:connect` publishes only `firebase.connect.json` to the existing `scotdance-connect` Hosting site. Its `/api/**` rewrite remains on that project's private-data API. API and Firestore rules stay in `mismith/scotdance-connect`. Never deploy Connect over the competition app, proxy private production APIs into local development, or expose real family data as fixtures.

Connect renders `src/account/AccountForm.vue` directly, using the user-scoped Firebase REST adapter. Only sign-in uses the existing identity-origin embed; do not reintroduce an account iframe. `/account-test.html` is emulator-only and must stay out of production build inputs.
