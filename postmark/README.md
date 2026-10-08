# Email templates

The Postmark templates the functions send (`TemplateAlias` in
`functions/src`), one folder each: `meta.json` (name, alias, subject, a test
model), `content.html` and `content.txt`.

Each email follows the app it came from (`functions/src/utility/emailModel.ts`).
The v4 app stamps `origin` on submissions and invites; those get the templates
here, linking back to the site they came from. The v3 apps don't, and get the
ones in `v3/`, as they always have. Emails to admin@ are always v4. `v3/`
goes once the v3 apps are gone (the v4 release runbook's "v4 emails").

The v4 templates share a layout, `_layouts/scotdance`: the head, styles, icon
and footer, with each template's body at `{{{ @content }}}`. Postmark inlines
its styles as it sends. The icon and font it loads are in `web/public/email/`.

This folder is the source of truth. Edit here, not in Postmark: merging to
`next` pushes changed templates (`.github/workflows/postmark.yml`). Deleting
a folder doesn't delete the template in Postmark; do that there too.

To preview them as Postmark renders them, each in its layout with its test
model: `npx postmark-cli templates preview postmark`. To push by hand:
`npx postmark-cli templates push postmark`. Both ask for the server's API
token.
