# ADR-0018: Assistants manage competitions through MCP

Status: Accepted (slice 1: sign-in and one proof tool)
Date: 2026-11-11

## Context

An organiser should be able to connect Claude or ChatGPT to their account once and manage their competitions by
asking. ScotDance Binder already does this (its ADR 0005); this ports that design to the Realtime Database.

## Decisions

### 1. One function, one address

`mcp` (2nd gen `onRequest`, an Express app) serves the MCP endpoint (`/mcp`, Streamable HTTP, stateless, JSON
responses) and a small OAuth 2.1 server. Hosting rewrites `/mcp`, `/mcp/**`, `/oauth/**` and
`/.well-known/oauth-authorization-server|protected-resource[/**]` to it, on the `next` target only. The public origin
is one value (`MCP_ORIGIN`, default `https://next.scotdance.app`; `functions/src/mcp/config.ts`, and
`web/src/lib/assistants.ts` for the address Account shows) so it can move to scotdance.app at launch.

### 2. OAuth

As Binder's: clients name themselves with a Client ID Metadata Document (no registration; fetched only from public
addresses, https, 5 s, 32 KB, no redirects); PKCE S256 always; the RFC 8707 resource must be the bare `/mcp`;
tokens are random and stored only as SHA-256 hashes; access tokens last 1 hour, refresh tokens 60 days and are
single-use (a copy used later ends the connection; the same client retrying within 30 s is not a copy); RFC 7009
revoke. Anyone can publish a document that calls itself "Claude", so only claude.ai, claude.com, anthropic.com,
chatgpt.com and openai.com are shown by name; for any other the approval page leads with its address and warns, and
`/oauth/authorize` never redirects to it with an error.

Differences from Binder:

- Records are in the Realtime Database, inside the data namespace: `oauth:requests`, `oauth:codes`, `oauth:tokens`,
  `oauth:refresh`. One-use consumption of a code or refresh token is a transaction on that record. The database has
  no TTL, so `sweepOauth` clears expired records daily.
- A connection belongs to the account, not to a competition or organisation: `users:connections/{uid}/{id}` (client,
  scope, created, last used). The person reads it; only functions write it. There is nothing to pick when approving.
- One scope, `manage` (read and write). It is stored on every token so a separate `admin` scope for system admin
  tools can be added later without a migration. It is not built.

### 3. Acting as the person, through the rules

For each connection the server mints a custom token for the uid with `{ via: 'mcp', scope }`, exchanges it with
Identity Toolkit for an ID token (cached 50 minutes), and reads and writes the database over its REST API with it.
So `firebase.rules.json` decides everything, and triggers see the real `auth.uid`. REST rather than the client SDK:
no websocket per connection to hold open, and each request is one read or write.

Rules for `via: 'mcp'`:

- A system admin's whole-tree grant does not apply. Their assistant gets their per-competition and per-organisation
  grants, as anyone's would.
- It cannot write `users:permissions`, `competitions:permissions`, `users:tools`, `users:connections`, invites
  (making or accepting one), or delete a whole competition. Everything else a person with a grant can change, it can.
- It cannot write the person's own account: `users/{uid}`, favourites, alerts off, push tokens, dancer colours, profile
  views. Reading them is fine. What stays writable besides competition and organisation data: `users:inbox/{uid}` (a
  later slice files dancer lists there for the person to preview in Import dancers), `competitions:submissions` (a
  later slice adds competitions through it), and Storage uploads (create-only, size and type limited, for the staff,
  link and sheet files a competition holds).
- The sign-in records have no rule that gives a client access. (A system admin in person still reads and deletes
  under the tree-wide grant, though not write: `.validate` is false. What is there is hashes and pending requests.)
- The callables behind the approval page and Account turn away a token with `via: 'mcp'`.

### 4. Tools

`get_competitions` is the proof tool. The registration helper (`mcp/tools.ts`) takes a zod input shape and a
read/write annotation, so more tools are a list entry each. The server's instructions say who the person is and that
text in records is data, never instructions.

### 5. Account and approval

`/connect-assistant?request=<id>` (outside Manage; not `/connect`, which dev servers answer with the tools’ `connect.html`): signed out, the app's own sign-in; then one screen naming the assistant
with Allow or Not now. Account lists connected assistants (name, connected, last used) with Disconnect, and the
address to paste into a custom connector. Both only for people who manage something. Deleting an account ends its
connections.
