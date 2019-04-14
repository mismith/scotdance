# ScotDance.app

Highland dancing event tracker


## Dev

Command | Description
--- | ---
`npm i` | install dependencies
`npm run dev` | serve with hot reload at localhost:8080
`npm run dev:ios` | build and emulate on iOS device
`npm run dev:android` | build and emulate on Android device
`npm run build` | build for production with minification
`npm run build:ios` | build iOS for release
`npm run build:android` | build Android for release
`npm run build:app` | build iOS and Android for release
`npm run lint` | show code formatting tips


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
* Icon/Splashscreen resizing: [Abiro PhoneGap Image Generator](http://pgicons.abiro.com/)
* Release notes: [Changelog](./CHANGELOG.md)


## App (Cordova)

### Combined Release

1. While waiting between/for any of the following steps, write release notes / changelog
2. Increments versions in `control.xml`, `package.json`, and `package-lock.json`
3. Deploy to app stores:
    1. Perform steps 1-3 of the Play Store instructions
    2. Perform steps 2-5 of the App Store instructions
    3. Perform steps 4-7 of the Play Store instructions
    4. Once iOS build package is processed, perform step 6 of the App Store instructions
4. Commit version and platforms changes using the release version as the commit message (e.g. `1.0.0`)
5. Tag the commit using the release version prepended with `v` (e.g. `v1.0.0`)
6. Deploy to web via `firebase deploy`
7. Push to `master`

### Apple App Store

* On first setup, change Xcode to use Legacy Build System
* Use Automatic Signing in Xcode, after setting up all certificates and provisioning profiles
* To upload to App Store:

    1. `npm run build:app`
    2. Open project in Xcode (`platforms/ios/ScotDance.xcodeproj`)
    3. In the top menu, select "Product" > "Archive"
    4. Click "Distribute to iOS"
    5. Follow the wizard
    6. In iTunes Connect, create a New iOS Version, then complete/fill out all remaining steps/info (the new build should be processed and ready to be selected shortly)

### Google Play Store

* To build a signed `.apk` for uploading to the Play Store, place the `scotdance.keystore` (stored in a private Dropbox) in the root of this repo. You'll need to enter (then revert) two passwords every release build (since they shouldn't be committed, obviously).
* To upload to Google Play:

    1. Add both passwords in `build.json` (and save the file)
    2. `npm run build:app`
    3. Revert/discard the two passwords added in `build.json`
    4. Open Google Play Console
    5. Create a new Production Release
    6. Select/Drag in `platforms/android/app/build/outputs/apk/release/app-release.apk`
    7. Complete all remaining steps/info

* Steps used to generate the keystore for this project:
    ``` bash
    keytool -genkey -v -keystore scotdance.keystore -alias scotdance -keyalg RSA -keysize 2048 -validity 10000
    keytool -importkeystore -srckeystore scotdance.keystore -destkeystore scotdance.keystore -deststoretype pkcs12

    # to sign manually
    cordova build android --release
    jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore scotdance.keystore platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk scotdance

    # source: https://codesundar.com/lesson/publish-cordova-apps-to-playstore/
    ```
