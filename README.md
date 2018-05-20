# ScotDance

> Highland dancing event tracker

## Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report
```

For a detailed explanation on how things work, check out the [guide](http://vuejs-templates.github.io/webpack/) and [docs for vue-loader](http://vuejs.github.io/vue-loader).

## Deploying to Google Play Store

* Helpful link: https://codesundar.com/lesson/publish-cordova-apps-to-playstore/

``` bash
cordova build android --release

keytool -genkey -v -keystore scotdance.keystore -alias scotdance -keyalg RSA -keysize 2048 -validity 10000
keytool -importkeystore -srckeystore scotdance.keystore -destkeystore scotdance.keystore -deststoretype pkcs12

jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore scotdance.keystore platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk scotdance

(optionally:) find ~/Library/Android/sdk/build-tools -name "zipalign"
~/Library/Android/sdk/build-tools/28.0.0-rc2/zipalign -v 4 platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk scotdance.apk
```