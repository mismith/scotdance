# ADR-0017: See and unlink the tools you sign in to

Status: Accepted
Date: 2026-11-08

## Context

"Sign in with ScotDance.app" (ADR 0015, decision 6) lets Challenge and
ScotDance Binder sign people in with their ScotDance.app account. Until now
ScotDance.app kept no record of it: `toolPass` signed a two-minute pass and
forgot it. So nobody could see which tools an account uses, and nobody could
sign out of a tool everywhere (a lost phone, a shared laptop), short of the
tool's own sign-out on each device.

## Decisions

### 1. A pass notes the link

`toolPass` writes `users:tools/{uid}/{tool}: { linkedAt, signedInAt }`:
when they first and last signed in to that tool with ScotDance.app. Nothing
else: no dancers, nothing from the tool. Only they and system admins read it;
only functions write it (they may delete their own, as deleting an account
does). Organisers never see it.

Splits and the Toolkit aren't tools you sign in to (Splits only sends a list
to your inbox), so they never appear.

### 2. Account › Tools

Their Account page lists the tools they sign in to, under "Tools", once there
is one: the tool's icon and name (opening it in a new tab) and when they last
signed in, with Unlink beside it. Mirrors the "Competitions they manage" rows
in System admin › Users.

### 3. Unlink signs them out there, everywhere, within the hour

Unlink calls `unlinkTool({ tool })`. It signs an unlink pass (the same
HS256 pass and secret, with `aud` set to `{tool}:unlink`, which no tool
accepts as a sign-in) and posts it to that tool's own `unlinkScotDance`
callable. The tool checks it and revokes the person's refresh tokens in its
project, so every device is signed out when its ID token next refreshes (an
hour at most). Then the link is deleted here. If the tool doesn't answer, the
link stays and they're told to try again: the list never says unlinked when
they aren't.

Their work in the tool stays (studios in Binder, entries in Challenge).
Signing in with ScotDance.app again links it again: that's already a tap they
choose ("Continue as …").

"Within the hour" is good enough for now. Signing out at once would need
every tool to watch for revocations.

### 4. System admins see and unlink too

System admin › Users filters by tool (All, Binder, Challenge; the count beside
the title follows), shows each user's tool icons on their row, and lists their
tools with first and last sign-in and Unlink (say for a lost phone).
`unlinkTool({ tool, uid })` for someone else needs system admin.

### 5. Deleting an account unlinks every tool

`unlinkTool({})` (no tool) unlinks all of theirs, before their data is
wiped. The account goes even if a tool doesn't answer. The tools keep their
name and email (Challenge on its Auth user, Binder on studio members): Murray's
call, as their work there stays too.

## Consequences

- Adding a tool: an `AUDIENCES` entry and its `UNLINK_URLS` callable
  (functions/src/toolPass.ts), a `TOOLS` entry with its icon
  (web/src/connect/protocol.ts, web/public/img/tools), and an
  `unlinkScotDance` callable in the tool.
- In the emulator, `unlinkTool` only calls a tool named in
  `TOOL_UNLINK_URL_<TOOL>` (its own emulator); otherwise it just forgets the
  link.
- Links made before this shipped are backfilled once from each tool's Auth
  users (functions/scripts/backfill-tool-links.mjs).
