# Verified email in tool passes

The signed `toolPass` payload now includes `emailVerified`, set only when Firebase's authenticated
`email_verified` claim is strictly `true`. Client request fields never set it. Missing claims remain false;
the ordinary sign-in flow is unchanged.

This supports Binder's family-email access and Entries' one-time dancer suggestions. It establishes control
of an inbox, not guardianship: Binder's studio-entered family contact is the other half of that connection.

Deploy `toolPass` before the dependent Binder and Entries changes. Existing linked-tool sessions need a fresh
ScotDance sign-in to receive the claim. No backfill should mark existing email addresses verified by inference.

Checks:

```sh
npm --prefix functions run build
node --test functions/scripts/test-tool-pass.mjs
```

These tests cover verified/unverified/missing/malformed claims, ignored client-supplied verification, Binder's
pass and anonymous-account rejection.
