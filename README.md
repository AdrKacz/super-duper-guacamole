# super-duper-guacamole

# Development

**Flutter** is quicker to setup than **React Native** *(I mean, literally quicker, it doesn't burn my laptop)*. I've used (Flutter Chat UI)[https://pub.dev/packages/flutter_chat_ui] to get a first chat without coding. *The same framework was available with **React Native***

# Codebase

```sh
# macOS: brew install cloc
>> cloc --exclude-ext=md .  
     266 text files.
     120 unique files.                                          
     400 files ignored.

github.com/AlDanial/cloc v 1.92  T=0.15 s (781.9 files/s, 57922.8 lines/s)
-----------------------------------------------------------------------------------
Language                         files          blank        comment           code
-----------------------------------------------------------------------------------
XML                                 39              7             45           3089
C/C++ Header                        26            348           1937            773
JSON                                11              1              0            603
C++                                  5             81             29            317
CMake                                4             34             30            167
Bourne Shell                         3             24             26            155
Dart                                 4             34             23            152
Bourne Again Shell                   1             19             20            121
YAML                                 4             26             82            109
Gradle                               3             19              3             88
HTML                                 1              9             15             80
Windows Resource File                1             23             29             69
DOS Batch                            1             24              2             64
JavaScript                           4             10              5             61
Markdown                             1              6              0             26
Objective-C                          3              6              4             21
Java                                 1              3              5             16
Swift                                1              1              0             12
Ruby                                 1              1              6             11
Properties                           3              0              1             10
Kotlin                               1              2              0              4
D                                    2              0              0              2
-----------------------------------------------------------------------------------
SUM:                               120            678           2262           5950
-----------------------------------------------------------------------------------
```

# Architecture

## Sequence

### Distributed

```mermaid
sequenceDiagram
      participant Client as Client
      participant Model as Model provider
      participant Match as Match maker
      participant Server as Server
      Client ->> Model: GET Model Y
      Model ->> Client: Model Y
      Client ->> Client: Inference
      par Actualise model
      Client ->> Model: POST Inference Gradient
      Model ->> Model: Actualise Model Y
      and Get UDP server
      Client ->> Match: POST Set of users
      Match ->> Match: Match users
      Match ->> Server: GET UDP Server
      Server ->> Match: PORT UDP Server
      Match ->> Client: PORT UDP Server
      end
```

In a **distributed architecture**, the code that infers the correct set of users belongs to the **client app**. Thus, it uses the client technologies: Godot and GDScript.

### Centralised

```mermaid
sequenceDiagram
      participant Client as Client
      participant Model as Model provider
      participant Match as Match maker
      participant Server as Server
      Client ->> Model: GET Set of users
      par Client model
      Model ->> Model: Get Model X of Client
      and Global model
      Model ->> Model: Get Model Y
      end
      Model ->> Model: Inference
      Model ->> Model: Actualise Model Y
      Model ->> Client: Set of users
      Client ->> Match: POST Set of users
      Match ->> Match: Match users
      Match ->> Server: GET UDP Server
      Server ->> Match: PORT UDP Server
      Match ->> Client: PORT UDP Server
```

In a **centralised architecture**, the code that infers the correct set of users belongs to the **cloud**. Thus, it uses whatever languages.

> We will first choose the **centralised architecture** to use state-of-the-art libraries in Machine Learning with **Python**. However, we'll keep the code as close as possible to a **decentralised** version, so we will be able to switch later on. The objective is to verify as quickly as possible that the model works.

## Cloud

### Centralised

![awa-services](./diagram-cloud-architecture/awa_service.png)

> `Federated` architecture will simply remove the **_client models_ database**

> Go to [https://awa-web-app.herokuapp.com](https://awa-web-app.herokuapp.com) for the Web version.

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

# How to build?

## Android

Go to `awa/android/app/build.gradle` and increase **Version code**.

```
cd awa/android
./gradlew bundleRelease
```

If there are errors, open **Android Studio** and build from here to see what are the problems. Most of the time file are duplicated, which causes problem when instantiate classes.

Then go to Google Play Console, update a new build.

## Web

```
heroku login
git subtree push --prefix awa-web heroku master
```

## iOS

Increment build number at `awa/ios/awa.xcodeproj`

Go to `Action` and run `Fastlane iOS CD`
