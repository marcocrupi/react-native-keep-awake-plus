# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- Added a React Native 0.84.1 smoke app under `example/`.
- Added `example/.npmrc` with `install-links=true` to avoid local `file:..`
  symlink issues with React Native Codegen.
- Added Jest coverage for KeepAwake owner counting.
- Added a manual multi-owner smoke UI in the example app.

### Changed

- Updated package identity to `@marcocrupi/react-native-keep-awake-plus`.
- Updated package metadata to point to the fork repository.
- Preserved original authorship and added Marco Crupi as fork maintainer.
- Refactored Android implementation to avoid storing `ReactApplicationContext`
  in a static field.
- Updated `<KeepAwake />` and `useKeepAwake()` to use JS owner counting.
- Removed the deprecated Android manifest `package` attribute and rely on the
  Gradle namespace for modern Android builds.
- Replaced the legacy Android `com.facebook.react:react-native:+` dependency
  with `compileOnly("com.facebook.react:react-android")` for modern React
  Native Android builds.
- Declared peer dependencies for React and React Native, with React Native 0.73
  as the minimum supported version and React Native 0.84 as the current
  development target.

### Fixed

- Fixed the legacy `Class.js` deep import so it uses the current native module
  implementation.
- Fixed multi-owner behavior for the component and hook so one owner unmounting
  does not disable keep-awake while another owner is still mounted.
- Reduced Android context leak and stale-context risk by avoiding a static
  React context.

### Packaging

- Added `types: "index.d.ts"`.
- Added a `files` whitelist to control the npm package contents.
- Kept `example/**` out of the npm package tarball.
- Excluded unnecessary files such as the Android Gradle wrapper and stale iOS
  xcodeproj from the package contents.

### Tests

- Added a root TypeScript typecheck setup for the public TypeScript/codegen
  surface.
- Fixed example TypeScript test module scoping so the example project can run
  `tsc --noEmit`.
- Verified locally Android Codegen, Android build, and Android runtime behavior
  with the included React Native 0.84.1 example.
- Verified locally iOS pod install and iOS build with the included React Native
  0.84.1 example.
- Verified React Native 0.73.11 compatibility from a local npm tarball,
  including Android old architecture build/runtime, Android New Architecture
  Codegen/build, iOS pod install/build, lint, root API smoke, and legacy
  `Class` deep import smoke.
- Added Jest tests for owner-counting behavior and imperative pass-through.

### Documentation

- Updated README to document fork status, installation, usage, multi-owner
  behavior, imperative behavior, compatibility notes, and the example app.

### Notes

- This is an independently maintained fork of
  `@sayem314/react-native-keep-awake`.
- Imperative APIs intentionally keep direct last-call-wins behavior.
- `Class.js` remains a legacy deep-import compatibility path and is not part of
  the documented main API.
- `exports`, Gradle cleanup, podspec cleanup, CI, and release policy remain
  follow-up items.
