# ScotDance

Highland dancing event tracker


## Dev

Command | Description
--- | ---
`yarn` | install dependencies
`yarn dev` | serve with hot reload at localhost:8080
`yarn lint` | show code formatting tips
`yarn build` | build for production with minification
`yarn build --report` | view the bundle analyzer report
`yarn deploy` | build and push web front-end to Firebase hosting
`yarn web` | build and preview web front-end via file:// protocol
`yarn ios` | build and emulate on iOS device
`yarn android` | build and emulate on Android device
`yarn build:app` | build iOS and Android for release
`yarn icon` | auto-generate all required app icons
`yarn splash` | auto-generate all required splash screen images


## Admin

* Database, Auth, SSL: [Firebase](https://console.firebase.google.com/u/0/project/firebase-scotdance/database/scotdance/data)
* Domain registrar: [Namecheap](https://ap.www.namecheap.com/domains/domaincontrolpanel/scotdance.app)
* DNS Provider: [Cloudflare](https://dash.cloudflare.com/f9b1ba7aa72b02f28e63a13fd4aa7184/scotdance.app)
* Email (alias) via [GSuite](https://admin.google.com)


## App (Cordova)

### Apple App Store

* [iTunes Connect](https://itunesconnect.apple.com/WebObjects/iTunesConnect.woa/ra/ng/app/1386475626)
* Use Automatic Signing in Xcode, after setting up all certificates and provisioning profiles
* To upload to App Store:

    1. `yarn build:app`
    1. Open project in Xcode (`platforms/ios/ScotDance.xcodeproj`)
    2. In the top menu, select "Product" > "Archive"
    3. Click "Upload to App Store..."
    4. Follow the wizard
    5. In iTunes Connect, create a New iOS Version, then complete/fill out all remaining steps/info (the new build should be processed and ready to be selected shortly)

### Google Play Store

* [Google Play Console](https://play.google.com/apps/publish/?account=6715160108161692003#AppDashboardPlace:p=info.mismith.scotdance&appid=4972780107515202457)
* To build a signed `.apk` for uploading to the Play Store, place the `scotdance.keystore` (stored in a private Dropbox) in the root of this repo. You'll need to enter both passwords every build (since they aren't stored in the committed `build.json`).
* To upload to Google Play:

    1. `yarn build:app`
    1. Open Google Play Console
    2. Create a new Production Release
    3. Select/Drag in `platforms/android/app/build/outputs/apk/release/app-release.apk`
    4. Complete all remaining steps/info
* Steps used to generate the keystore for this project:
    ``` bash
    keytool -genkey -v -keystore scotdance.keystore -alias scotdance -keyalg RSA -keysize 2048 -validity 10000
    keytool -importkeystore -srckeystore scotdance.keystore -destkeystore scotdance.keystore -deststoretype pkcs12

    # to sign manually
    cordova build android --release
    jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore scotdance.keystore platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk scotdance

    # source: https://codesundar.com/lesson/publish-cordova-apps-to-playstore/
    ```

