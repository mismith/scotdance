# Firebase account emails

Password resets and email-change recovery notifications remain Firebase-owned:
Firebase selects the recipient, generates the action link and enforces its
sending limits. The project sends these through Postmark SMTP from
`admin@scotdance.app` (STARTTLS, port 587), using the existing ScotDance server.
No custom sender domain or Firebase DNS records are required for this delivery.

The HTML fragments here use the same `scotdance` Postmark layout and footer as
other emails. Firebase stores the rendered HTML; Postmark SMTP delivers it.
Keep `%LINK%`, `%EMAIL%` and `%NEW_EMAIL%` as Firebase placeholders. Action links
use `data-pm-no-track` so Postmark does not rewrite recovery links.

Run from the repository root with the existing Google administrator login:

```sh
node scripts/sync-auth-email-templates.mjs         # Render fictional previews
node scripts/sync-auth-email-templates.mjs --apply # Update only these templates
```

The script reads the existing `RUNTIME_CONFIG` secret in memory, renders through
Postmark, and updates only `resetPasswordTemplate` and `changeEmailTemplate`.
It never sends email. Re-run after changing the shared Postmark layout.

SMTP credentials live only in Firebase's notification configuration and the
existing server secret, never in Git. SMTP was enabled on 17 November 2026;
its prior method was `DEFAULT`. Reverting just `notification.sendEmail.method`
to `DEFAULT` restores Firebase delivery. Password reset and email recovery still
use Firebase's hosted action handler. Branded verification from Connect uses
the separate authenticated callable and Postmark `verify-email` template.
