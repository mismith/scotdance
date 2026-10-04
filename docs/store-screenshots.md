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

## Upload them

Each lane uploads the screenshots and nothing else (no build, no text, no
submission). From `web/`:

```bash
npm run store:upload:ios
```

```bash
npm run store:upload:android
```

- **App Store:** they go on the version being prepared in App Store Connect
  (create the version first), and show when it's released.
- **Google Play:** they replace the listing's phone screenshots, and show once
  Google has reviewed the change.

### Keys

Both lanes read their keys from the environment. Keep the key files outside
the repo (for example in `~/.config/scotdance/`, or the repo root, where `AuthKey_*.p8` and `play-service-account.json` are ignored) and set, in your shell profile:

```bash
export APP_STORE_CONNECT_API_KEY_KEY_ID=…
export APP_STORE_CONNECT_API_KEY_ISSUER_ID=…
export APP_STORE_CONNECT_API_KEY_KEY_FILEPATH=~/.config/scotdance/AuthKey_….p8
export SUPPLY_JSON_KEY=~/.config/scotdance/play-service-account.json
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

fastlane itself: `brew install fastlane`.
