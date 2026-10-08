# Store screenshots

The App Store and Google Play screenshots are made from the app itself, with
demo data, and live in the projects where fastlane reads them:

- `ios/App/fastlane/screenshots/en-CA/`: iPhone 6.9" (`iphone-*`) and iPad 13" (`ipad-*`)
- `android/fastlane/metadata/android/en-CA/images/phoneScreenshots/`: Play phone

## Remake them

From `web/`:

```bash
npm run store
```

It starts its own emulator stack (on ports offset by 40, beside a dev stack,
with an empty database), seeds the demo (Cowal, made-up dancers), captures each
screen, stops the stack, and renders the art over the files above. About a
minute and a half. Needs Docker (for search), Chrome and ffmpeg, and
`functions/.secret.local` with `RUNTIME_CONFIG={}`.

The art (slots, headlines, colours, props) is in `web/store/shots.ts` and
`web/store/compose.ts`; the screens in `web/store/scenes.ts`; the demo data in
`web/store/demo.ts`. To iterate, keep a stack up with `npm run store:stack`,
then `npm run store` reuses it, and `npm run store:render` redraws the art from
the last captures without the stack.

## The App Store header

iOS 27's product page header, above the screenshots: the dancer colours as
folded silk on a 20-second loop, with no words (Apple puts the icon, name
and Get button over it). It doesn't use the captures, so it's its own step.
From `web/`:

```bash
npm run store:header
```

It writes `ios/App/fastlane/creative/en-CA/header.mp4` (about 13 minutes:
Chrome draws 600 frames at 3840 × 1646; about 95 MB, near lossless, so git
ignores it and the same command makes it again exactly). `node store/creative.ts still`
writes its first frame to `store/out/creative/` to look at. The look is in
`web/store/creative.ts`.

Search results still show the first three screenshots: there's no search
results asset. To add one, put `search.png` (3:2) beside the header and the
upload places it too.

## Upload them

Each lane uploads the store art and nothing else (no build, no text, no
submission). From `web/`:

```bash
npm run store:upload:ios
```

```bash
npm run store:upload:android
```

- **App Store:** they go on the version being prepared in App Store Connect
  (create the version first), and show when it's released. After the
  screenshots, `store/upload.ts` puts the header on the same version through
  App Store Connect's asset library (fastlane can't yet), replacing the one
  there. It only does that when the version being prepared is this
  checkout's (`package.json`), and does nothing if the file hasn't changed.
  `node store/upload.ts --plan` says what it would do without changing
  anything.
- **Google Play:** they replace the listing's phone screenshots, and show once
  Google has reviewed the change.

### Keys

Each lane reads its keys from a `.env` beside its Fastfile, which fastlane
loads itself and git ignores. Keep the key files outside the repo, in a folder
any app's project can point at (for example `~/.config/store-keys/`; the repo
root also works, where `*.p8` and `play-service-account.json` are ignored).
Use full paths: `.env` files don't expand `~`.

`ios/App/fastlane/.env`:

```bash
APP_STORE_CONNECT_API_KEY_KEY_ID=…
APP_STORE_CONNECT_API_KEY_ISSUER_ID=…
APP_STORE_CONNECT_API_KEY_KEY_FILEPATH=/Users/…/.config/store-keys/app-store-connect-key.p8
```

`android/fastlane/.env`:

```bash
SUPPLY_JSON_KEY=/Users/…/.config/store-keys/play-service-account.json
```

- **App Store Connect API key:** App Store Connect › Users and Access ›
  Integrations › App Store Connect API › Team Keys › +, access **App
  Manager**. Download the `.p8` (only offered once); the Key ID is on its row
  and the Issuer ID above the table.
- **Google Play service account:** in Google Cloud (any project), enable the
  **Google Play Android Developer API**, create a service account and a JSON
  key for it. Then in Play Console › Users and permissions › Invite new users,
  invite the service account's email, with the ScotDance app and **Store
  presence › Edit store listing** permission.

fastlane itself: `brew install fastlane`, 2.240 or newer (older ones reject the 6.9" iPhone and 13" iPad sizes). The uploads also run from the repo root.
