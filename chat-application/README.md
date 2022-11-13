# awachat

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://flutter.dev/docs/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://flutter.dev/docs/cookbook)

For help getting started with Flutter, view our
[online documentation](https://flutter.dev/docs), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

# Network connections

## Send a HTTP request

[![](https://mermaid.ink/img/pako:eNqFkD1vAjEMhv-K5RkkKnXKgITEcO10Ehd1yWIlBqJyzjVxBor4781xYmGpJ-t5_frrhj4FRoOFfyqL532kU6bRCbTYeU0ZLFABWzgvsKes0ceJRKGbpW4Yetj1H4tsYb3dQmcgzx2LLrR7UGvgffNmwApVPaccfzm8uEo8CUR5cX1-DTCkb5Z_ZjRsZ1qmJIWd4ApHziPF0E68zWUO9cwjOzQtDXykelGHTu6ttC2VDlfxaDRXXmGdAunzI2iOdCl8_wM3hF3h?type=png)](https://mermaid.live/edit#pako:eNqFkD1vAjEMhv-K5RkkKnXKgITEcO10Ehd1yWIlBqJyzjVxBor4781xYmGpJ-t5_frrhj4FRoOFfyqL532kU6bRCbTYeU0ZLFABWzgvsKes0ceJRKGbpW4Yetj1H4tsYb3dQmcgzx2LLrR7UGvgffNmwApVPaccfzm8uEo8CUR5cX1-DTCkb5Z_ZjRsZ1qmJIWd4ApHziPF0E68zWUO9cwjOzQtDXykelGHTu6ttC2VDlfxaDRXXmGdAunzI2iOdCl8_wM3hF3h)

## Connect to WebSocket

[![](https://mermaid.ink/img/pako:eNp1kD9rAzEMxb-KEB1TaCGTh4NAh2ung5zx4kW1lcQkJ6f-MzQh3z0-rqFDqSbxfnp6SFd00TMqzPxVWRy_BdonmqxAq4FSCS6cSQoYoAyGP7fRHbksfONKTKBnojOnv6Z-Rv04DrAZ3hes4bkDo-DJRRF2P5tMUzvQCtYvrwq0UC2HmMKF_a-rg15BDnuBIIvaP1wfZoQxHln-y8AVTpwmCr7dep2nLJYDT2xRtdbzjuqpWLRya6MtPW6_xaEqqfIK69lTebwG1Y5OmW93HFdh0Q?type=png)](https://mermaid.live/edit#pako:eNp1kD9rAzEMxb-KEB1TaCGTh4NAh2ung5zx4kW1lcQkJ6f-MzQh3z0-rqFDqSbxfnp6SFd00TMqzPxVWRy_BdonmqxAq4FSCS6cSQoYoAyGP7fRHbksfONKTKBnojOnv6Z-Rv04DrAZ3hes4bkDo-DJRRF2P5tMUzvQCtYvrwq0UC2HmMKF_a-rg15BDnuBIIvaP1wfZoQxHln-y8AVTpwmCr7dep2nLJYDT2xRtdbzjuqpWLRya6MtPW6_xaEqqfIK69lTebwG1Y5OmW93HFdh0Q)

## Set up HTTP and WebSocket connections

## Add assets

### From SVG

```sh
# at project root
rsvg-convert -h 512 assets/undraw/image.svg > awa-chat-flutter/awachat/assets/images/image.png

# or use script
sh assets/convert.sh 512 image
```

## Set up notications

[**Add Firebase to your Flutter app**](https://firebase.google.com/docs/flutter/setup?platform=ios)

[**Firebase - Flutter - Messaging - Usage**](https://firebase.flutter.dev/docs/messaging/usage/)

> **WARNING**: install `Firebase CLI` with *auto install script*: https://firebase.google.com/docs/cli

> **WARNING**: update **minimum iOS version** supported from **9.0** to **11.0** to support `firebase_messaging`

> **WARNING**: update **minSdkVersion** supported from **flutter.minSdkVersion *16*** to **19** to support `firebase_messaging`

> **WARNING**: update **compileSdkVersion** supported from **flutter.compileSdkVersion *31*** to **33** to support `firebase_messaging`

> **WARNING**: update **targetSdkVersion** supported from **flutter.targetSdkVersion *31*** to **33** to support `firebase_messaging`

## Change App Package Name

[**Change app package name**](https://pub.dev/packages/change_app_package_name)

## Change App Icon

[**Change app icon**](https://pub.dev/packages/flutter_launcher_icons)


```
flutter pub get
flutter pub run flutter_launcher_icons:main
```

### iOS

**Use a 1024x1024 icon**

> Icon doesn't show on top of application (when showing all open applications)

### Android

## How to release

**CodeMagic** will release a new version of the app in the *App Store - Testflight* and the *Google Play Store - Internal* when a new version of `chat-application` is push to the `main` branch.

**CodeMagic** uses a *iOSDistribution* certificate and profile stored locally (ask @AdrKacz) and copied to *CloudMagic Cloud*.

## How to *manually* release

> You shoudn't have to release manually. Release is handled by **CodeMagic**

1. **Increment the build number `x.y.z+a` in `pubspec.yaml`**

2. Run `flutter clean` before building to avoid past artefacts.

### iOS

> [Flutter documentation - iOS deployment](https://docs.flutter.dev/deployment/ios)

> **Update `ios/Runner.xcodeproj/project/pbxproj` to use build information from `pubspec.yaml` (see [StackOverflow - Update Version and Build number](https://stackoverflow.com/questions/61922857/how-to-force-flutter-to-update-my-version-and-build-number/67080868#67080868))**

```
flutter build ipa
```

The output is at `build/ios/archive/Runner.xcarchive`


Then open `.xcarchive` on `Finder` and click on `Validate`.


| iPhone Display  | iPhone Model  | iPhone Screen Size  |
|:----------|:----------|:----------|
| iPhone 6.5" Display    | iPhone 11 Pro Max, iPhone Xs Max   | 2688 × 1242 px   |
| iPhone 5.5" Display   | iPhone 8 Plus, iPhone 7 Plus, iPhone 6s Plus   | 1080 x 1920 px   |
| iPad Pro (3rd Gen) 12.9" Display    | iPad Pro (12.9-inch) (3rd generation)    | 2732 × 2048 px    |
| iPad Pro (2nd Gen) 12.9" Display   | iPad Pro (12.9-inch) (2nd generation)| 2732 × 2048 px    |


### Android

> [Flutter documentation - Android deployment](https://docs.flutter.dev/deployment/android)

```
flutter build appbundle
```

The output is at `build/app/outputs/bundle/app-release.aab`
