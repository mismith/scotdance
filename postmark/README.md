# Email templates

The Postmark templates the functions send (`TemplateAlias` in
`functions/src`), one folder each: `meta.json` (name, alias, subject, a test
model), `content.html` and `content.txt`.

This folder is the source of truth. Edit here, not in Postmark: merging to
`next` pushes changed templates (`.github/workflows/postmark.yml`). Deleting
a folder doesn't delete the template in Postmark; do that there too.

To push by hand: `npx postmark-cli templates push postmark` (it asks for the
server's API token, then shows what will change).
