# Listing the ScotDance.app MCP in the Claude and ChatGPT directories

The organiser MCP (ADR 0018) listed as **ScotDance.app for Organisers** in both directories, as ScotDance Entries
was on 25 November 2026 (its `docs/mcp-store-submission.md` has the full requirement tables, read from the official
pages on 24 November 2026; they are summarised here).

Server: `https://next.scotdance.app/mcp`. It stays at next.scotdance.app after the v4 launch, so listed connections
never break; moving the listing to scotdance.app later is a new review, only if worth it.

## 1. What the directories check

| Topic          | Claude                                                                                  | ChatGPT                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Transport      | Streamable HTTP                                                                         | Streamable HTTP                                                                                            |
| OAuth          | DCR or CIMD, PKCE S256, 401 with `resource_metadata`, `resource` equals the MCP URL     | CIMD (preferred) or DCR, PKCE S256, RFC 8707 `resource`; RFC 9207 `iss` for the fixed redirect             |
| Annotations    | `title` and `readOnlyHint` / `destructiveHint` ("tools that modify or delete data")     | `readOnlyHint`, `destructiveHint`, `openWorldHint` as explicit booleans                                    |
| Descriptions   | Say what the tool does; don't tell the model how to behave or steer it to other tools   | Purpose, when to use, limits; no steering, promotion or comparisons                                        |
| URLs           | Documentation, privacy policy, support contact                                          | Website, support, privacy policy, terms                                                                    |
| Listing        | Name ≤ 100, one-liner ≤ 200, description ≤ 2000, 1 to 5 categories, icon, permanent slug | `displayName` ≤ 30, `shortDescription` ≤ 30, `longDescription` ≤ 4000, ≤ 3 default prompts ≤ 128          |
| Review         | Auto-scan, listed as Community; test access asked by email for Verified                 | 5 positive and 3 negative test cases, demo recording URL, release notes, test account in the portal       |
| Domain         | Server domain matches the service                                                       | Token served at `/.well-known/openai-apps-challenge`                                                       |
| Hard rejects   | Moving money, generated media, ads, adult content                                       | Demo apps, moving money, digital goods, ads, content unsuitable for 13 to 17                               |
| Where          | [claude.ai/directory/manage](https://claude.ai/directory/manage) → Submit new → MCP connector | [platform.openai.com/plugins](https://platform.openai.com/plugins) → Upload new plugin (the ZIP)     |

## 2. Done on this branch

- [x] `serverInfo`: title "ScotDance.app", `websiteUrl` (`/ai`) and icons (`/img/favicon.svg`, `/img/icon-512x512.png`).
      Version 1.0.0.
- [x] Every tool has `annotations.title` and all four hints as explicit booleans. Every write that can change or replace
      what is there is destructive (Claude's definition), even though the change log undoes it; only `draft_dancers`,
      `create_organisation` and `add_competition` (add something new, touch nothing else) are not. Tested.
- [x] No tool description or input description names another tool or tells the model what to do (tested). The
      behaviour rules (confirm before publishing or removing, read placings back, the as-is line) stay in the server
      instructions, which neither directory restricts; the destructive hints make both hosts confirm writes.
- [x] OAuth: `authorization_response_iss_parameter_supported: true` (every authorization response already carried
      `iss`), so ChatGPT uses its fixed redirect; `state` up to 4096 characters (ChatGPT's relay sends about 900; the
      Entries connection failed on this); `resource_documentation` in the protected resource metadata.
- [x] Public documentation page `/ai`: Add to Claude / ChatGPT / another AI app (the connector address), things it does,
      what it can and can't do, help and privacy. Landed on next separately (d73f207d).
- [x] Privacy: "Connected AI assistants" (`/policies#ai`). Terms: new section (`/policies#terms`); `/terms` and
      `/privacy` redirect there.
- [x] Hosting rewrite `/.well-known/openai-apps-challenge` → `/openai-apps-challenge.txt` (file added once the portal
      gives the token).
- [x] ChatGPT package in `submission/` (`python3 submission/package.py` builds the ZIP; the icon is the app icon).

## 3. Still to do (in order)

1. Deploy: push `next` (web: `/ai`, policies, rewrite) and `firebase deploy --only functions:mcp` (annotations,
   descriptions, OAuth metadata, state length). Check live: `/ai`, `/terms`, `/.well-known/oauth-authorization-server`
   shows `authorization_response_iss_parameter_supported`, and `tools/list` shows the new hints.
2. [x] Reviewer account: `test@scotdance.app` is an admin of Test Competition on ScotDance.app (Murray's invite
   `-P7JgDucEnZrwkKThDsm`, accepted 25 November 2026). It has no inbox: find an invite link in
   `competitions:data/{id}/invites` and open it while signed in as the account.
3. Test Competition holds 542 entries: confirm the names are made up, not a copy of a real competition's dancers,
   before reviewers read them.
4. Claude: submit at claude.ai/directory/manage with the copy below. Refresh tools, run every tool once (step 8).
5. ChatGPT: upload the ZIP, connect with the test account, put the domain token in
   `web/public/openai-apps-challenge.txt` and deploy, record a demo, fill `demo_recording_url`, rebuild, submit.

## 4. Listing copy

The listing never names the developer.

**Name**: ScotDance.app for Organisers (28 characters)

**Short description** (ChatGPT, ≤ 30): Manage highland competitions

**One-liner** (Claude, ≤ 200): Run your highland dancing competitions on ScotDance.app: entries, schedule, draws and
results, with every change logged and undoable.

**Description** (≤ 2000; the same as `longDescription`): see `submission/package/plugin.json`.

**Categories** (Claude): Productivity; Events (or the nearest listed).

**Use cases** (Claude): set up a competition from last year's program; add and correct entries, or file a whole list
to import; build the schedule and draws; enter results on the day; keep an organisation's page current. Needs a
ScotDance.app account that manages a competition or organisation. Reads and writes.

**Example prompts**:

1. Enter the results from this photo of the scrutineer's sheet.
2. Draw every age group at random, with the reels in number order.
3. Set up the age groups and dances from last year's program.
4. Here are this year's entries: make them an entry list I can import.
5. Who's still missing results, and which age groups have no callbacks yet?

ChatGPT default prompts: 1, 2 and 3. The `/ai` page shows the same jobs.

**URLs**:

| Field                   | URL                                                                 |
| ----------------------- | ------------------------------------------------------------------- |
| Website / documentation | https://next.scotdance.app/ai                                       |
| Support                 | https://next.scotdance.app/ai#help (chat and admin@scotdance.app)  |
| Privacy policy          | https://next.scotdance.app/policies                                 |
| Terms                   | https://next.scotdance.app/terms                                    |
| MCP server              | https://next.scotdance.app/mcp                                      |

**Icon**: `web/public/img/icon-512x512.png` (512×512 PNG), `web/public/img/favicon.svg`.

**Release notes (v1)**: see `publication.release_notes` in `submission/package/plugin.json`.

## 5. Reviewer instructions

- Account: `test@scotdance.app`, password only (no code or second factor). The password is never written here; it
  goes only into the ChatGPT portal's reviewer fields, or the email Anthropic sends for Verified review.
- Sample data: Test Organisation (`-P6D5qWRi9r5twWZ5TIK`) and Test Competition (`-Mt_GJ1hBjN2ayVM1Sts`, 31 December
  2030, unlisted and unpublished: nothing a reviewer changes is public or alerts anyone).

Steps for the reviewer:

1. Connect the server and sign in with the ScotDance.app email and password given. Press Allow.
2. Ask "Which of my competitions are coming up?" The connector lists Test Competition.
3. Try the test cases (in `submission/package/plugin.json`: list, read the dances, add a judge, undo it, read results;
   and refuse to add an admin, to delete the competition, or to give addresses and birthdates).
4. To see what changed, sign in at https://next.scotdance.app with the same account: Account › AI assistants.

## 6. Submission status

- ChatGPT: **submitted 25 November 2026**, plugin `scotdance-organisers` 1.0.0 "In review" in the mur.bot OpenAI
  organization. Domain verified; scan connection authorized as the test account; 24 tools scanned, no blocking findings
  (server instructions, `save_dancers` and `draft_dancers` flagged "needs further review"; "privacy policy website
  accessible" non-blocking, the policies page is rendered by JavaScript). All six attestations ticked, including "does
  not target children under 13 or share their personal information with OpenAI" (Murray's call: tools return dancers'
  names). Demo: `submission/scotdance-organisers-chatgpt-demo-2026-11-25.mp4` in the app's Storage.
- Claude: **submitted 25 November 2026**, "ScotDance.app for Organisers", slug `scotdance-app`, categories Productivity
  and Nonprofit, CIMD OAuth, read and write, all 7 policies acknowledged, "self-tested every tool" left unticked. The
  captured tool list predates 83820dea's `get_competitions` wording ("Start here…"); the live server has the new text.
- After submitting, `get_competitions`' description changed (no "Start here"); ChatGPT rescans hosted servers daily and
  may hold the changed tool for review.
- Murray's ChatGPT has a custom MCP app "ScotDance.app for Organisers" connected as the test account (for the demo).
