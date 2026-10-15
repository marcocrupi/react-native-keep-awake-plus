# Native compatibility CI

The matrix is New Architecture first. Old Architecture remains best effort. A
peer range permits npm resolution; it does not certify every React Native
version in that range. Native builds and host lifecycle tests do not establish
physical-device runtime or release-store qualification.

## Matrix and qualification

`Native compatibility` adds independent checks without altering the JavaScript
workflow. `scripts/native-ci/matrix.json` is the explicit, exact-version policy.

| Selection | Android | iOS | Trigger |
| --- | --- | --- | --- |
| Stable | 0.87.1, 0.86.3 | 0.87.1, 0.86.3 | Every PR, main push, manual stable |
| Regression anchor | 0.85.3 | 0.85.3 | Manual anchor only |

All selected native jobs must succeed. The final `Required native compatibility`
check fails if contracts, Android, or iOS fail, skip, or cancel. Repository branch
protection is not changed by these files; a maintainer can select that check after
an actual GitHub run. An anchor run never certifies the stable matrix.

Baseline `main@0d4fbfaab0c86d6bb16b4daa26384b6b181ef7fa` is GitHub-qualified
for the stable matrix on 2026-10-15:
[Native compatibility run 38753921648](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38753921648)
passed contracts, both Android lanes, both iOS lanes and the final required
check. [JavaScript run 38753921594](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38753921594)
also passed. The manual 0.85.3 anchor is configured separately; this stable run
does not prove an anchor run or physical-device runtime. Local 2.0.0 API
changes have their own validation and do not inherit a remote GitHub PASS.

## What each lane proves

Every lane packs the checkout with `npm pack`, extracts that actual archive,
generates a fresh real Community CLI project using pinned CLI 20.1.3 and the
exact RN template, then installs the archive using standard `npm install`.
There is no root/example install dependency, peer bypass, source symlink, or
local source substitution. Installed RN and autolinking roots are checked.
Every distributed file is compared byte for byte before and after native work;
the consumer lock must contain the archive's SHA-512 integrity. The generated
consumer imports the package so release bundling includes its real JS entry.

Android requires clean package Codegen, existing package lifecycle/regression/
deadlock unit suites (no skipped tests), Debug and Release application builds
with only `arm64-v8a`, and generated autolinking. It verifies actual compiled
classes for both variants, DEX class descriptors inside both APKs, consumer AGP
identity, selected New Architecture source set, and Codegen output. These are
host unit tests and compiled APKs; no emulator/device interaction is asserted.

AGP 9 and its new DSL are different contracts. An AGP 9 consumer must retain
`android.newDsl=false` and `android.builtInKotlin=false`, as the official RN
0.87.1 template does. The new DSL is not qualified by this matrix.

The iOS lane starts without Pods, generated outputs or DerivedData, pins
CocoaPods 1.16.2, runs Codegen during `pod install`, and compiles a complete
unsigned arm64 simulator app. It requires the package-specific generated header,
compiled Objective-C++ object, native class actually linked into the app, and
Pods pointing at the archive installation. Official RN Core/dependency prebuilt
artifacts are selected explicitly with `RCT_USE_PREBUILT_RNCORE=1` and
`RCT_USE_RN_DEP=1`; the candidate pod itself is compiled from archive sources.
`RCT_NEW_ARCH_ENABLED=1` is explicit. Successful Pods installation alone is not
success. Both the legacy and RN 0.87 `ReactCodegen/` output layouts are checked.

## AGP 9 new DSL probe

The P2-A probe uses a fresh official RN 0.87.1 / CLI 20.1.3 consumer with a
physical local npm archive, Gradle 9.4.1, AGP 9.2.1, JDK 17 and New Architecture.
With the official template unchanged, configuration succeeds with
`android.newDsl=false` / `android.builtInKotlin=false`.

**NOT QUALIFIED / UPSTREAM BLOCKED (2026-10-15).** With both flags `true`,
configuration exits 1 at the unchanged template's `android/app/build.gradle:2`:
`org.jetbrains.kotlin.android` cannot add extension `kotlin` because it already
exists. The matching false/false configuration exits 0 and records AGP 9.2.1.
Autolinking discovers the physically installed package. New-DSL Codegen, module
and application compilation are **NOT RUN**, blocked before task execution;
this does not establish package-level new-DSL compatibility.

Setting both to `true` is evaluated separately from the stable CI matrix.
[RN 0.87's official guidance](https://reactnative.dev/blog/2026/08/11/react-native-0.87)
recommends both opt-outs, and the template applies `org.jetbrains.kotlin.android`.
[Android's migration guide](https://developer.android.com/build/migrate-to-built-in-kotlin)
requires removing that plugin before enabling built-in Kotlin. Do not infer new
DSL qualification from an AGP 9 build with the opt-outs. The release checklist
records the probe's actual outcome; no RN/template patch or stable matrix change
is authorized by this experiment.

## Runners, cost and reproducibility

Node 24.14.1 / npm 11.11.0 and Java 17 are pinned. Android uses `ubuntu-24.04`,
SDKs 36 and 37.0, build tools 36/37, and NDK 27.1.12297006. iOS uses the standard
`macos-26` arm64 image and `/Applications/Xcode_26.6.app`; missing Xcode fails
immediately. Runner OS, SDKs, Xcode and actual versions are logged. Provisioning
profiles, device signing, larger runners and paid runner labels are unnecessary.

On 2026-10-15 GitHub's runner inventory documents macos-26 arm64 (3 cores,
7 GB RAM), Xcode 26.6 on that image, and free standard runners for public repos.
This repository is public and its Actions API reports enabled/allowed-actions
all with read-only default workflow permissions. The workflows request only
`contents: read`. This API inspection does not substitute for scheduling/running a GitHub job. See the
[runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
and [macOS image inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md).

No dependency, Pods, Codegen, DerivedData or Gradle build cache is restored by
these workflows. Gradle build and configuration caches are disabled. Each lane
refuses an existing workspace. Ordinary immutable download caches on a local
host may still provide npm/Maven artifacts; they cannot replace candidate
Codegen or compiled outputs. The consumer's newly resolved npm and Pod locks,
exact commands/exits, source hashes, test reports and compiler logs are uploaded
on success and failure. Dependency resolution within the real RN template is
not frozen across time: retain the uploaded lock to reproduce a particular run.

Android runs at most two lanes concurrently, iOS one per workflow run, with
70/60 minute ceilings. PR superseding commits cancel older native runs. There is
one Android invocation for tests and both build variants rather than independent
heavy duplicate builds. iOS compiles Debug only; adding 0.86.3 gives a second
stable consumer at bounded cost. Anchor builds are opt-in. Artifacts expire in
7 days. Existing JS checks continue independently.

## Release monitoring deferred

Automatic React Native release monitoring is deferred. This integration includes
no scheduled discovery or notification workflow. The exact matrix is maintained
manually; adding a version requires its own native qualification and review.

## Local reproduction

Use the pinned Node/npm, Android SDK/Java for Android, or macOS/Xcode/CocoaPods
for iOS. Consumer/artifact directories must be new absolute paths outside the
checkout. Native jobs are reproducible independently:

```sh
node --test scripts/native-ci/contracts.test.cjs
node scripts/native-ci/lane.cjs android 0.87.1 /tmp/keep-awake-android-0871
node scripts/native-ci/lane.cjs ios 0.87.1 /tmp/keep-awake-ios-0871
node scripts/native-ci/lane.cjs android 0.86.3 /tmp/keep-awake-android-0863
node scripts/native-ci/lane.cjs ios 0.86.3 /tmp/keep-awake-ios-0863
node scripts/native-ci/lane.cjs android 0.85.3 /tmp/keep-awake-anchor-android
node scripts/native-ci/lane.cjs ios 0.85.3 /tmp/keep-awake-anchor-ios
```

Run the optional real npm/Codegen/javac negative witnesses only
against a completed disposable Android lane (never the checkout/example):

```sh
node scripts/native-ci/negative-witness.cjs /tmp/keep-awake-android-0871 /tmp/keep-awake-negative
```

The witness restores mutated archive sources in `finally` and verifies byte
identity; a successful mutation fails the witness. After negative experiments,
revalidate using a fresh `lane.cjs` workspace. No source/dependency edits,
commit, push, release, or remote dispatch are performed by these scripts.
