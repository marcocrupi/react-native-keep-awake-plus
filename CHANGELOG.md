# Changelog

<!-- markdownlint-configure-file { "MD024": { "siblings_only": true } } -->

All notable changes to this project will be documented in this file.

## 2.0.0 — Unreleased

Prepared in the repository on 2026-10-15. At that date npm `latest` and the latest
GitHub Release remain 1.6.1; committing 2.0.0 does not publish it.

### Breaking changes

- All public native keep-awake APIs now share ownership within each JS runtime.
  Root activate/deactivate manage one idempotent implicit request instead of
  direct last-call-wins native calls. Deactivate releases only that request.
- Legacy Class statics manage a distinct implicit request. Neither family can
  release another family's request, a hook, component, token or mounted Class
  instance. Only the last owner requests native off; there is no force-off API.
- Deactivate without a matching request is a no-op, including with a missing
  native module. A throwing final release remains consumed.
- Modernized native build requirements follow the consumer RN template and
  CocoaPods helpers; see [compatibility](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md).
  See [migration from 1.6.1](MIGRATION.md) for affected patterns.

### Added

- Optional `enabled` boolean for the hook and root component, defaulting to true.
- `acquireKeepAwake()` with an independent, idempotent release for each task.
- Public TypeScript coverage and example controls for conditional and token owners.

### Changed

- All control APIs use the common JS coordinator; first acquisition and last
  release request native transitions. Activation errors retain no owner;
  deactivation errors propagate after consuming cleanup. No OS-state getter added.
- Android Gradle inherits consumer plugins/SDK policy, enables BuildConfig and
  leaves target SDK policy to the application.
- iOS packaging uses RN's minimum-iOS and module-dependency helpers. The example
  uses UIScene. Native module and package identifiers are preserved.
- User and maintainer documentation now separates 2.0.0 behavior, publication
  status, compatibility evidence and release steps.

### Fixed

- Android lifecycle reconciliation, shared native runtime ownership, listener
  races, stale work and terminal invalidation.
- iOS main-queue idle-timer reconciliation, shared native runtime ownership and
  invalidation/deallocation without holding the state mutex across UIKit calls.
- Package validation rejects malformed metadata and duplicate paths; CocoaPods
  contracts inspect effective iOS settings, including platform overrides.
- Excluded the unused Gradle negative-witness fixture from the npm archive;
  existing Java regression sources remain available for archive-consumer tests.

### Compatibility

- RN peer range widened to `>=0.73.0 <0.88.0`; peers permit installation and do
  not certify every version. React peers remain `>=18.2.0 <20.0.0`.
- Stable New Architecture CI: RN 0.86.3 and 0.87.1, Android/iOS. RN 0.85.3 is a
  separate regression anchor. Old Architecture has historical, best-effort scope.
- RN 0.87.1 AGP 9 uses official false/false DSL/Kotlin opt-outs. True/true remains
  unqualified because of the verified upstream template Kotlin extension conflict.

### Security

- Remediated vulnerable development HTTP/XML/YAML, Metro/image-size, browser-data
  and shell-quote dependency paths. No runtime npm dependency added.
- Development tooling retains `braces` GHSA-vfj7-8cjw-p6xm; full audits remain
  nonzero. Security closure documents residual risk, not a clean audit.

### Testing/CI

- Added exact-version native archive-consumer CI with provenance, Codegen,
  Android lifecycle host tests and Debug/Release builds, and iOS simulator builds.
- Added typecheck, lint, package and effective CocoaPods contract gates.
- Added ownership, enabled, StrictMode, missing-module and native-error tests.
- JS and stable native CI passed on the 2.0.0 implementation commit. Separate
  local RN 0.87.1 emulator/simulator mixed-owner OS checks passed; CI does not run
  those runtime checks. Physical devices and same-process scene reconnection
  remain unqualified. See [evidence](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md).

## 1.6.1 - 2026-06-27

### Fixed

- Fixed the legacy `/Class` deep import lifecycle so it shares the declarative
  keep-awake owner counter with the root component and hook. This prevents one
  legacy `Class` instance from disabling keep-awake while another declarative
  owner is still mounted.
- Made the native entrypoints import-safe when the `ReactNativeKCKeepAwake`
  native module is not registered. The native module is now resolved lazily and
  an explicit error is thrown when keep-awake functionality is used, instead of
  crashing at import time.

### Added

- Added TypeScript declarations for the legacy `/Class` and `/Class.js` deep
  imports.
- Added `NativeKCKeepAwakeModule.js` as the shared lazy native module resolver
  used by the native entrypoints.
- Added missing-native test coverage for the root native entry, legacy `/Class`
  deep imports, imperative APIs, static legacy APIs, and owner-counting recovery
  after a failed native activation.

### Security

- Updated the example Ruby constraints to require `concurrent-ruby >= 1.3.7`
  and `activesupport >= 7.2.3.1`, with the example Ruby baseline raised to
  `>= 3.1.0`.
- Updated the example React Native CLI packages to `20.1.3`, resolving the
  vulnerable `fast-xml-parser` dependency path through `fast-xml-parser`
  `5.9.3`.
- Added an example-only `js-yaml` override to `4.2.0` to eliminate the remaining
  vulnerable Jest/Istanbul tooling dependency path.

### Documentation

- Documented that `@marcocrupi/react-native-keep-awake-plus` is intended to
  replace `@sayem314/react-native-keep-awake`, not to be installed alongside
  it, because the fork keeps legacy native identifiers that may collide at the
  CocoaPods, native module, Codegen, or Android package level.

## 1.6.0 - 2026-05-18

### React Native 0.85.3 Compatibility

- Added installable React Native 0.85.x support by widening the React Native
  peer range to `>=0.73.0 <0.86.0`.
- Updated the included smoke app to React Native 0.85.3 and matching
  `@react-native/*` packages.

### React Native 0.85.3 Validation

- Validated React Native 0.85.3 with the New Architecture through the included
  smoke app.
- Passed Android and iOS runtime smoke checks with the React Native 0.85.3
  smoke app.
- Kept the public API unchanged.
- Retained the legacy bridge files for compatibility with the supported React
  Native range.
- Kept Jest coverage for owner counting, imperative pass-through calls, and
  legacy `Class` deep imports passing on the updated smoke app.

## 1.5.0 - 2026-05-11

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
- `exports`, Gradle cleanup, podspec cleanup, and release policy remain
  follow-up items.
- A minimal package/typecheck/tarball/example CI workflow exists; Android
  native CI, iOS native CI, a permanent old/new architecture matrix, release
  automation, and npm publish automation remain follow-up items.
