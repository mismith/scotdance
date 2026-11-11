# shared

Pure TypeScript that the web app and the Cloud Functions both build from, so a rule is written once.
No Vue, Firebase or DOM imports; nothing here touches the network or the clock unless it's handed in.

- **web** imports it as `@shared/...` (Vite alias and tsconfig path, see `web/vite.config.ts`).
- **functions** imports it by relative path (`../../shared/...`). Its `tsconfig.json` has `rootDir: ".."`
  and includes this folder, so `tsc` emits `functions/dist/shared/` beside `functions/dist/functions/src/`
  (`main` is `dist/functions/src/index.js`). Everything `firebase deploy` and the emulator need stays inside `functions/`.
- Import with no file extension, as the rest of the code does.

`plans/` turns "what the organiser did" into one multi-path database update:
`(current competition, intent) → { data, info, lasting, summary, warnings }`. Paths are relative to
`competitions:data/{id}` (`data`) or `competitions/{id}` (`info`); `lasting` is written after, kept out of Undo.
New ids come in as arguments (`newId`), never made here.
