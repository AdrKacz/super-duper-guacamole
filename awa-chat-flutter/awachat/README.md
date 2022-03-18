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

## Set up notications

[**Add Firebase to your Flutter app**](https://firebase.google.com/docs/flutter/setup?platform=ios)

[**Firebase - Flutter - Messaging - Usage**](https://firebase.flutter.dev/docs/messaging/usage/)

> **WARNING**: install `Firebase CLI` with *auto install script*: https://firebase.google.com/docs/cli

> **WARNING**: update **minimum iOS version** supported from **9.0** to **11.0** to support `firebase_messaging`

## Change App Package Name

[**Change app package name**](https://pub.dev/packages/change_app_package_name)

## Change App Icon

[**Change app icon**](https://pub.dev/packages/flutter_launcher_icons)

### iOS

**Use a 1024x1024 icon**

> Icon doesn't show on top of application (when showing all open applications)

### Android

## How to release

> **Increment the build number `x.y.z+a` in `pubspec.yaml`**

> Run `flutter clean` before building to avoid past artefacts.

### iOS

> [Flutter documentation - iOS deployment](https://docs.flutter.dev/deployment/ios)

> **Update `ios/Runner.xcodeproj/project/pbxproj` to use build information from `pubspec.yaml` (see [StackOverflow - Update Version and Build number](https://stackoverflow.com/questions/61922857/how-to-force-flutter-to-update-my-version-and-build-number/67080868#67080868))

```
flutter build ipa
```

Then open `.xcarchive` on `Finder` and click on `Validate`.

iPhone Display | iPhone Model
-- | --
iPhone 6.5" Display | iPhone 11 Pro Max, iPhone Xs Max
iPhone 5.5" Display | iPhone 8 Plus, iPhone 7 Plus, iPhone 6s Plus
iPad Pro (3rd Gen) 12.9" Display | iPad Pro (12.9-inch) (3rd generation)
iPad Pro (2nd Gen) 12.9" Display | iPad Pro (12.9-inch) (2nd generation)

### Android

> [Flutter documentation - Android deployment](https://docs.flutter.dev/deployment/android)

```
flutter build appbundle
```

