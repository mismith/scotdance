# Typesense upgrade runbook

Typesense on Render goes from 0.23.1 to 30.2, in place, and the search
callables get a key that can only search. Search is down from switch step 2
until step 5's rebuilds finish, 10 to 20 minutes (mostly the functions
deploy), so pick a time with no competition running. The apps only talk to
the functions, so old app versions don't notice: one set of functions serves
them all, before and after.

## What changes

- Newer Typesense reads a leading `$` in `filter_by`, `group_by` and
  `include_fields` as a join (`$collection(…)`), so the current functions fail
  every search on 30.2. The dancers, judges and pipers indexes hold the same
  values under `name` and `competitionId` (`name` is `personName()`, as `$name`
  was, set after the entry's own fields). The callables rename them back, so
  the apps get `$name` and `$competitionId` as before (the v3 apps in the
  stores can't change). The competitions index drops its unused `$name` (the
  app reads `name`).
- `searchAll` and `searchDancers` search with `typesense.search_api_key`
  (`documents:search` on competitions, dancers, judges and pipers only). The
  admin key, `typesense.api_key`, is for indexing only. Without
  `search_api_key` in `RUNTIME_CONFIG`, both fail with "RUNTIME_CONFIG has no
  typesense.search_api_key": there's no fallback to the admin key.
- Competitions in search: among equally good matches, those coming up come
  first (soonest first), then past ones (latest first), then any with no
  date; a better match (on the name rather than the venue, say) still leads.
  "Fraser" used to fill its five with the oldest years. The index gets a
  sortable `day` (20261212); `searchAll` runs two competition searches, from
  yesterday in UTC on and before it, and joins them by match.
- A rebuild reads everything first, then empties the index and fills it 1,000
  documents a request, so search is empty for seconds rather than minutes. It
  returns a count, not the documents (all 117,000 dancers went in one 30 MB
  request, against a 10 s timeout, and came back as a 30 MB response).
- Render runs 30.2 in `/app/typesense-data/v30`: 30 can't hand its data back
  to 0.23, so 0.23's stays at the disk's root for a rollback. CORS is off
  (Typesense has it on by default; only Cloud Functions call it). The service
  deploys from `next`, by hand.

## Checked locally

- 115,000 dancers (the CI seed, 17 times over) under Render Starter's limits
  (512 MB, half a CPU): rebuilt in 5 s, using 212 MB of memory and 48 MB of
  disk.
- 199 searches, signed out, as an organiser and as an admin, through
  `searchAll` and `searchDancers`: this code on 30.2 gives what `next` gives on
  0.23.1 for dancers, judges, pipers, places and organisations, documents
  included. Competitions differ only in order and the dropped `$name`. Two
  differences come from 30.2 itself: "Calgary" no longer finds dancers called
  Calder, and a search of several words can find a competition that matches
  only some of them.
- Misspelt and part names (300 tries): 30.2 found every name 0.23.1 found.
- The new functions give the same results on 0.23.1 (so a rollback needs no
  functions deploy), and with only the search key, which can't write, read a
  document by id, export or list keys.
- The Dockerfile starts 30.2 in an empty `v30` beside 0.23's data, and 0.23.1
  still reads its own data afterwards.
- `backend-functions.spec.ts` passes; in the app, search finds dancers,
  judges, venues and competitions, newest first.

## Before the day

1. Render › scotdance-typesense › Settings: Branch `next` (it was `main`),
   Auto-Deploy off. Done 2026-10-11. The service is "Blueprint managed" by a
   Blueprint on `develop` that last synced two years ago: it only syncs again
   if `render.yaml` changes on `develop`.
2. Room: 0.23 uses 0.65 GB of the 1 GB disk (2026-10-11), and 30.2 adds about
   0.1 GB. Memory sits around 120 MB of 512 MB, but it ran out three times
   between July and September 2026: if a rebuild in step 5 fails while Render
   restarts the instance, run it again.

## The switch

`firebase login --reauth` first; run from the repo root, in one terminal.

1. Merge this branch to `next` and push (next.scotdance.app deploys as usual).
   From here until step 4, no one else deploys functions from `next`.
2. Render › scotdance-typesense › Manual Deploy › Deploy latest commit. It
   starts 30.2 in an empty `v30` folder. Search is down from here.
3. Make the search key, on the server and in `RUNTIME_CONFIG`:

   ```bash
   CONFIG=$(firebase functions:secrets:access RUNTIME_CONFIG)
   HOST=$(CONFIG=$CONFIG node -p 'JSON.parse(process.env.CONFIG).typesense.host')
   ADMIN_KEY=$(CONFIG=$CONFIG node -p 'JSON.parse(process.env.CONFIG).typesense.api_key')
   SEARCH_KEY=$(openssl rand -hex 32)
   curl -s "https://$HOST/debug" -H "X-TYPESENSE-API-KEY: $ADMIN_KEY"
   curl -s "https://$HOST/keys" -X POST -H "X-TYPESENSE-API-KEY: $ADMIN_KEY" \
     -H 'Content-Type: application/json' \
     -d "{\"description\":\"Cloud Functions search (searchAll, searchDancers)\",\"actions\":[\"documents:search\"],\"collections\":[\"competitions\",\"dancers\",\"judges\",\"pipers\"],\"value\":\"$SEARCH_KEY\"}"
   CONFIG=$CONFIG SEARCH_KEY=$SEARCH_KEY node -e 'const c = JSON.parse(process.env.CONFIG); c.typesense.search_api_key = process.env.SEARCH_KEY; process.stdout.write(JSON.stringify(c))' \
     | firebase functions:secrets:set RUNTIME_CONFIG --data-file -
   ```

   The first `curl` says `"version":"30.2"`. If `secrets:set` offers to
   update the functions, say no: step 4 does.
4. `firebase deploy --only functions` from `next`.
5. next.scotdance.app/admin/tools › Search: Rebuild Competitions, Judges,
   Pipers and Dancers. Each says "Done: N indexed." (2026-10-02: about 824,
   1,638, 548 and 117,000). Search is back.
6. Check:
   - next.scotdance.app signed out: a dancer, a judge, a piper, a venue, a
     town and an organisation; signed in as a non-admin, the same. "Fraser"
     lists the coming ones first.
   - The v3 app signed in as a non-admin: a dancer search.
   - The search key can only search (`401`), and CORS is off (prints nothing):

     ```bash
     curl -s -o /dev/null -w '%{http_code}\n' "https://$HOST/collections" -H "X-TYPESENSE-API-KEY: $SEARCH_KEY"
     curl -s -i -X OPTIONS "https://$HOST/collections" -H 'Origin: https://example.com' -H 'Access-Control-Request-Method: GET' | grep -i access-control
     ```

   - Render › Metrics: memory settles well under 512 MB. Over the next day,
     the functions logs: no `Typesense:` errors.
7. A week on, if nothing's needed rolling back: Render › Shell,
   `rm -rf /app/typesense-data/db /app/typesense-data/meta /app/typesense-data/state`
   (0.23's data; leave `v30`).

## Rollback

From step 2 on. The functions stay as they are: they work on 0.23.1 too.

1. Render › scotdance-typesense › Events: roll back to the deploy before. It
   starts 0.23.1 on its own data, as it was at step 2.
2. Make the same search key on it, the one already in `RUNTIME_CONFIG`:

   ```bash
   CONFIG=$(firebase functions:secrets:access RUNTIME_CONFIG)
   HOST=$(CONFIG=$CONFIG node -p 'JSON.parse(process.env.CONFIG).typesense.host')
   ADMIN_KEY=$(CONFIG=$CONFIG node -p 'JSON.parse(process.env.CONFIG).typesense.api_key')
   SEARCH_KEY=$(CONFIG=$CONFIG node -p 'JSON.parse(process.env.CONFIG).typesense.search_api_key')
   ```

   Then step 3's `/keys` `curl`.
3. Rebuild the four searches again (step 5): the old indexes have the old
   field names.

## Local

`npm run local` and `npm run store:stack` run 30.2 (Docker pulls it the first
time). `npm run local` keeps its data in `.typesense/emulator-data-v30`, which
starts empty: rebuild the four searches once at localhost:5273/admin/tools.
The old `.typesense/emulator-data` can go after that. The emulator uses `xyz`
for both keys.
