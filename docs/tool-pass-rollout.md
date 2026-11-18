# Public-key passes and service identity

The rollout is complete: passes are signed with the hub's private key, server-to-server calls carry Google
service identity, and the old shared `TOOL_PASS_SECRET` is gone. How it works is in ADR 0015 and
`docs/entries-integration.md`.

## Checking the service accounts

In the logs, for the service accounts being what the code expects (`service.ts` `SERVICES`):

- hub: no `No service proof for …`
- Entries: no `Could not get a service identity token`
- any tool or the hub bridge: no `Unknown service`. If one appears, the caller runs as a different account
  than `SERVICES` lists: fix the list in all four repos. That call fails until then; membership and deletion
  retry by themselves.

## Replacing the key later

Make a new pair with `node functions/scripts/new-pass-key.mjs | gcloud secrets versions add TOOL_PASS_PRIVATE_KEY --project firebase-scotdance --data-file=-` (the public key and `kid` print on screen), add the new public key to
`PASS_PUBLIC_KEYS` beside the old one, deploy the tools, deploy the hub, then remove the old public key.
