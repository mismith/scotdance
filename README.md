# [ScotDance.app](https://scotdance.app)

> Highland dancing event tracker

Skip the pen and paper—attend highland dance competitions in style with this app for your mobile device.

Modernize your highland dancing experience by interacting with program-of-events information digitally:
- Search through dancers by their competition number, name, age group, etc. Then mark your favourites for easy tracking.
- Track your 'favourite' dancers to make it easy to follow you/your children/friends.
- Use the at-a-glance schedule to check event start times, which platforms to dance at, order of dances, and more.
- Get real-time results updates—from callbacks through to placings—and review them anytime after a competition, too.

## Dev

Command | Description
--- | ---
`npm i` | install dependencies
`npm run dev` | serve with hot reload at localhost:8080
`npm run build` | build for production with minification
`npm run lint` | show code formatting tips
`npm run report` | open bundle size inspector
`npm run release` | create version commit and tag in git
`npm run deploy` | push local build to production


## Admin

Links to the admin panels needed to manage this project:

* Database, Users/Auth, Hosting, SSL: [Firebase](https://console.firebase.google.com/u/0/project/firebase-scotdance/database/scotdance/data)
* iOS app: [iTunes Connect](https://itunesconnect.apple.com/WebObjects/iTunesConnect.woa/ra/ng/app/1386475626)
* Android app: [Google Play Console](https://play.google.com/apps/publish/?account=6715160108161692003#AppDashboardPlace:p=info.mismith.scotdance&appid=4972780107515202457)
* DNS: [Cloudflare](https://dash.cloudflare.com/f9b1ba7aa72b02f28e63a13fd4aa7184/scotdance.app)
* Domain: [Namecheap](https://ap.www.namecheap.com/domains/domaincontrolpanel/scotdance.app)
* Email hosting (alias): [GSuite](https://admin.google.com)
* Email sending/templates: [Postmark](https://account.postmarkapp.com/servers/4370108/overview)
* Live Chat: [Crisp](https://app.crisp.chat/website/160e5d08-deea-4187-a21b-39762a904c26/inbox/)
* Release notes: [Changelog](./CHANGELOG.md)


## App (Capacitor)

### Combined Release

1. While waiting between/for any of the following steps, write release notes in `CHANGELOG.md`
2. Adjust/increment the version in `package.json` (this will be propagated by the `sync-version` script that gets called pre-`build`)
3. Build and Deploy to app stores:
    1. Perform steps 1-5 of the Apple App Store instructions
    2. Perform steps 2-8 of the Google Play Store instructions
    3. Once iOS build package is processed, perform step 6 of the App Store instructions
4. Finalize the release via `npm run release`, which consists of:
    1. Commit version change and release notes using the release version as the commit message (e.g. `1.0.0`)
    2. Tag the commit using the release version prepended with `v` (e.g. `v1.0.0`)
5. Deploy to web via `npm run deploy`, which consists of:
    1. Deploy to web via `firebase deploy`
    2. Push to `master`
6. In the Firebase Console's Realtime Database explorer, update the appropriate version numbers as apps are released: `/<env>/versions/<platform>`

### Apple App Store

* Use Automatic Signing in Xcode, after setting up all certificates and provisioning profiles
* To upload to App Store:

    1. `npm run build`
    2. Open project in Xcode (`npx cap open ios`)
    3. In the menu bar, select "Product" > "Archive"
    4. Click "Distribute to iOS"
    5. Follow the wizard
    6. In iTunes Connect, create a New iOS Version, then complete/fill out all remaining steps/info in form
        - the new build should be processed and ready to be selected shortly

### Google Play Store

* To build a signed `.aab`, you'll need the `scotdance.keystore` file (stored in a private Dropbox).
* To upload to Google Play:

    1. `npm run build`
    2. Open project in Android Studio (`npx cap open android`)
    3. In the menu bar, select "Build" > "Generate Signed Bundle / APK…"
    4. Follow the wizard (choose AAB, enter keystore creds, choose release)
    5. Open Google Play Console
    6. Create a new Production Release
    7. Select/Drag in `android/app/release/app-release.aab`
    8. Complete all remaining steps/info in form
