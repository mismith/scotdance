# scotdance-web

- **Styling**: Tailwind utilities only. No custom classes with raw CSS rules. For descendant styling, use arbitrary variants on the parent (`[&_:is(strong,em)]:text-foreground`) rather than a wrapper class with child selectors. `<style>` blocks are reserved for things Tailwind can't reach: `html`/`body`/pseudo-elements (`::before`, `::after`), or third-party DOM created in JS (e.g. MapLibre nodes); even then, prefer `@apply` over hand-written declarations.
- **Icon-only buttons**: `rounded-full`, ≥44×44 (`size-11`); shrink to `size-9` inside nav-action chrome and `size-7` inside form inputs.
- **Copy rules**:
  - Never abbreviate to "comp" / "comps" in user-facing copy. Always "competition" / "competitions". Code identifiers (e.g. `CompChip`, `comp-` CSS classes) are fine.
  - Em dashes: use sparingly. Prefer period, comma, or colon. When kept, no spaces: `word—word`, not `word — word`.
  - No first-person plural ("we" / "us" / "our") in user-facing copy. The project is volunteer-run by one person — "we" implies a team that doesn't exist. Rephrase neutrally or use imperative voice.
