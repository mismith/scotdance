# ScotDance

Highland dancing event tracker


## Dev

Command | Description
--- | ---
`yarn` | install dependencies
`yarn dev` | serve with hot reload at localhost:8080
`yarn lint` | show code formatting tips
`yarn build` | build for production with minification
`yarn report` | view the bundle analyzer report
`yarn deploy` | build and push web front-end to Firebase hosting
`yarn web` | build and preview web front-end via file:// protocol
`yarn ios` | build and emulate on iOS device
`yarn android` | build and emulate on Android device
`yarn build:app` | build iOS and Android for release
`yarn icon` | auto-generate all required app icons
`yarn splash` | auto-generate all required splash screen images


## Admin

Links to the admin panels needed to manage this project:

* Database, Auth, SSL: [Firebase](https://console.firebase.google.com/u/0/project/firebase-scotdance/database/scotdance/data)
* iOS app: [iTunes Connect](https://itunesconnect.apple.com/WebObjects/iTunesConnect.woa/ra/ng/app/1386475626)
* Android app: [Google Play Console](https://play.google.com/apps/publish/?account=6715160108161692003#AppDashboardPlace:p=info.mismith.scotdance&appid=4972780107515202457)
* DNS: [Cloudflare](https://dash.cloudflare.com/f9b1ba7aa72b02f28e63a13fd4aa7184/scotdance.app)
* Domain: [Namecheap](https://ap.www.namecheap.com/domains/domaincontrolpanel/scotdance.app)
* Email (alias): [GSuite](https://admin.google.com)


## App (Cordova)

### Combined Release

1. While waiting between/for any of the following steps, write release notes / changelog
2. Increments versions in `control.xml` and `package.json`
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

* Use Automatic Signing in Xcode, after setting up all certificates and provisioning profiles
* To upload to App Store:

    1. `yarn build:app`
    2. Open project in Xcode (`platforms/ios/ScotDance.xcodeproj`)
    3. In the top menu, select "Product" > "Archive"
    4. Click "Upload to App Store..."
    5. Follow the wizard
    6. In iTunes Connect, create a New iOS Version, then complete/fill out all remaining steps/info (the new build should be processed and ready to be selected shortly)

### Google Play Store

* To build a signed `.apk` for uploading to the Play Store, place the `scotdance.keystore` (stored in a private Dropbox) in the root of this repo. You'll need to enter (then revert) two passwords every release build (since they shouldn't be committed, obviously).
* To upload to Google Play:

    1. Add both passwords in `build.json` (and save the file)
    2. `yarn build:app`
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
