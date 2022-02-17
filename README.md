# super-duper-guacamole - *dev-gun*

Development branch of **awa** application.

This branch aims to build a version based on a **decentralised** data storage technologie and puts **privacy** first.

# Useful links

- [Stack Overflow - Seeding the random number generator in javascript](https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript)

# Dependencies

- [React Native](https://reactnative.dev), code in *JavaScript* and build on *iOS* and *Android*.
- [Notifee](https://notifee.app), handles and displays notifications on *iOS* and *Android*.
- [React Native Firebase](https://rnfirebase.io), connects to a *Firebase* project, used to connect to *Firebase Cloud Messaging*.
- [GunDB](https://gun.eco), decentralised database.
- [Flyer Chat](https://flyer.chat), chat UI implementation
- [FastLane](https://fastlane.tools), tools to build and deploy iOS app and Android app automatically, used with *[GitHub Action](https://github.com/features/actions)*.

# Deployment

- [Heroku](https://heroku.com), hosts servers to redistribute notifications and relay-servers for *GunDB*.
- [Firebase](https://firebase.google.com), sends notifications to devices.
- [GitHub](https://github.com), stores codebase.
- [Google Play Console](https://play.google.com/console/), deploys the app to internal and external testers via mailing lists, and deploys app to *Google Play Store*.
- [App Store Connect](https://appstoreconnect.apple.com), deploys the app to internal and external testers via *TestFlight*, and deploys app to *AppStore*.

# Develop

```sh
git clone -b dev-gun --single-branch https://github.com/AdrKacz/super-duper-guacamole.git
cd super-duper-guacamole
```

## Files to add (if you build with your own project)

- `awa/ios/GoogleService-Info.plist`

# Run on *iOS* or on *Android*

```sh
cd awa
yarn
npx pod-install
```

*If you don't have `yarn` install, either use `npm` ([migrating from npm](https://classic.yarnpkg.com/lang/en/docs/migrating-from-npm/)) instead, or install [`yarn`](https://classic.yarnpkg.com/en/).*

`./awa` directory holds the codebase for the *React Native* project. Follow the official steps for [iOS deployment and Android deployment](https://reactnative.dev/docs/environment-setup) (switch to *React Native CLI QuickStart* tab).


# Steps for CI/CD (*do later, kind of bored on this*)

[Detox](https://wix.github.io/Detox/docs/introduction/getting-started)

```
brew tap wix/brew
brew install applesimutils

yarn add -D detox-cli
yarn add -D detox

yarn remove -D detox-cli
yarn remove -D detox
```

# Export

## iOS

Increment build number at `awa/ios/awa.xcodeproj`

Push to main

## Android

Increment build number at `awa/android/app/build.gradle`

```
cd awa/androidd
.grandlew bundleRelease
```

## Web

```
git subtree push --prefix awa-web heroku master
```