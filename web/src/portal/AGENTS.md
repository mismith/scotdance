# Keep Connect and Entries dancer forms aligned

These are intentionally separate Vue implementations for now. Do not introduce a shared package or publishing workflow just to keep them aligned.

Before changing dancer fields, validation, autofill, default inheritance, loading/saving or editing UX, inspect the corresponding Entries implementation in `mismith/scotdance-entries` (use its active checkout/worktree, not an assumed local path):

| Connect (`mismith/scotdance`, this directory) | Entries (`mismith/scotdance-entries`) |
| --- | --- |
| `DancerPage.vue` | `src/views/DancerEditor.vue` |
| `DancerDefaults.vue` | `src/ui/DancerDefaults.vue` |
| `DancerDetails.vue` | `src/ui/DancerDetails.vue` |
| `BirthdayField.vue` | `src/ui/BirthdayField.vue` |
| `CityField.vue` | `src/ui/PlaceField.vue` |
| `AccountDefaults.vue`, `account.ts` | `src/views/AccountEditor.vue`, `src/data/account.ts`, `src/data/dancers.ts` |

- Apply relevant behavioral fixes to both and check both forms. Styling, navigation and authentication wrappers can remain app-specific. Do not blindly copy framework-specific classes or imports.
- Saved profiles permit incomplete optional details; competition entry requirements remain Entries-specific.
- New dancers copy shared studio/city defaults. Existing dancers keep their own values. First/only-dancer changes can update defaults; with multiple dancers, ask before changing defaults. Never rewrite submitted entry snapshots.
- Preserve browser autofill hints, studio capitalization, revision checks, refresh-on-return and unsaved drafts.
- Public results-profile linking currently lives in Connect; do not accidentally erase its link when saving through Entries or add new UI parity without scope.
- If the counterpart is unavailable or deliberately differs, report the gap instead of claiming parity. These comments are a reminder, not automated enforcement.
