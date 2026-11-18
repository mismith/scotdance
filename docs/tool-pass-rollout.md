# Rolling out public-key passes and service identity

Branch `claude/public-key-passes` in four repos: `scotdance` (hub), `scotdance-entries`, `scotdance-binder`,
`scotdance-challenge`. How it works is in ADR 0015 and `docs/entries-integration.md`; this is only the order
to ship it in.

Every receiver accepts the old way and the new way, and every sender sends both, so a half-finished rollout
keeps working. The one hard rule: **the tools deploy before the hub**, because the hub starts signing with
the new key the moment it deploys.

## 1. Create the hub's signing key (once)

```bash
node functions/scripts/new-pass-key.mjs | gcloud secrets create TOOL_PASS_PRIVATE_KEY --project firebase-scotdance --data-file=-
```

The private key goes straight into Secret Manager and is never shown. The public key and its `kid` print on
screen. The public key is not secret.

## 2. Give the tools the public key

Paste the public key into `PASS_PUBLIC_KEYS` in `functions/src/passKeys.ts` in Entries, Binder and Challenge
(and the hub's copy, to keep the files the same), and commit. Until this is done, deployed tools only accept
old passes.

## 3. Challenge's own link secret (once)

```bash
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create COMPLIMENT_LINK_SECRET --project scotdance-challenge --data-file=-
```

Challenge will not deploy without it.

## 4. Deploy the tools (any order)

- Entries: production and development.
- Binder, then give its new `deleteScotDanceAccount` the same public-invoker setting as its other callables.
- Challenge, likewise for its `deleteScotDanceAccount`.

Nothing changes for people yet: the hub is still sending old passes, and the tools still take them.

## 5. Deploy the hub, in this order

1. Functions (`default` codebase): passes are now signed with the key; calls to tools carry a service proof.
2. `auth-hooks` codebase: account deletions now queue for Binder and Challenge too.
3. Web: `dev.entries.scotdance.app` and Entries previews now ask for `entries-dev` passes.

## 6. Check, straight away

- Sign in to Entries, dev.entries, Binder and Challenge.
- A Challenge admin, and Binder staff, need a **verified** ScotDance.app email from now on. Check yours first.
- Unlink a tool from Account, and re-link it.
- Add or remove an organisation admin and see it reach Entries.
- Delete a throwaway ScotDance.app account that has used all three tools; each tool's `deletedAccounts/{uid}`
  should read `complete` and its sign-in should be gone.
- Logs, for the service accounts being what the code expects (`service.ts` `SERVICES`):
  - hub: no `No service proof for …`
  - Entries: no `Could not get a service identity token`
  - any tool or the hub bridge: no `Unknown service`. If one appears, the caller runs as a different account
    than `SERVICES` lists: fix the list in all four repos. Until then that one call fails (it is not allowed
    to fall back to the old pass once a proof is sent); membership and deletion retry by themselves.

## 7. Clean up (about a week later)

Search each repo for `LEGACY(tool-pass-secret)` and delete what it marks: old-pass acceptance, old signers,
the fallback when no proof is available, and every `TOOL_PASS_SECRET` binding. Deploy tools and hub, then:

```bash
gcloud secrets delete TOOL_PASS_SECRET --project firebase-scotdance
```

and the same for `scotdance-entries`, `scotdance-binder` and `scotdance-challenge`. Compliment links emailed
before step 4 stop working at this point.

## Replacing the key later

Run step 1 with `gcloud secrets versions add` instead of `create`, add the new public key to
`PASS_PUBLIC_KEYS` beside the old one, deploy the tools, deploy the hub, then remove the old public key.
