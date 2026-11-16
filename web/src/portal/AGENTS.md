# One owner-profile dancer editor

`DancerEditor.vue` is the single owner-profile form. `DancerPage.vue` adapts the native Connect account store; `editor/EditorApp.vue` hosts the same component for Entries and Binder's parent signup/portal. Preserve the existing Connect design, birthday typing/picker, registration/category toggle, defaults pencil/Use default, city autocomplete and compact public-profile link.

- Do not copy the form into sibling apps or introduce a shared-package release workflow. `portal/public/dancer-editor.js` is the versioned message client; apps retain small typed persistence adapters only.
- All three uses edit the signed-in owner's private Connect profiles. Binder staff edit studio snapshots using Binder's own UI. Signup submits a whitelisted copy only when the parent sends it. No matching public link, family ID or teacher role authorizes private access.
- The hosted UI has no auth session and never receives identity tokens. Authenticate in the host app using the existing central sign-in; server handlers derive the owner. Check exact message origin, source and instance. Only the selected profile, defaults and a sibling-presence flag enter the editor. Only a completed save/delete result returns.
- Capture defaults revisions when opening; preserve unsaved drafts and stable retry IDs. Existing dancers and submitted entries/studio snapshots are never rewritten when defaults change.
- Native Connect uses its own API adapter; hosted clients use Entries' owner callables or Binder's owner callable. Public link `null` means explicitly unlinked and must round-trip without automatic relinking.
- `DancerDetails.vue` is legacy UI, not the owner editor. Entries' local birthday/details controls still serve competition-specific participant records; they are not the shared owner-profile form.
- The iframe fills the viewport; the existing Connect dialog owns the card/sheet, scroll area and child pickers. The loader owns background inertness, loading, cancellation and return focus. Never nest a small iframe inside another card.
- Local previews use fictional data, sample city results and sample public matches. Never proxy production private APIs into development.

See `docs/connect-editor.md` at the repository root for contract, local checks and release order. Account editing remains native and out of this widget's scope.
