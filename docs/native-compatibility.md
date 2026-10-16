# Native compatibility CI

The matrix is New Architecture first. Old Architecture remains best effort. A
peer range permits npm resolution; it does not certify every React Native
version in that range. Native builds and host lifecycle tests do not establish
physical-device runtime or release-store qualification.

## Support policy

The package supports every stable React Native release with the New
Architecture, from **0.76** onward. RN 0.76 is the first release where the New
Architecture is stable and enabled by default; from RN 0.82 it is the only
architecture. Upstream React Native defines the window; this package
does not cap it.

- The npm peers have **no upper bound** (`react-native >=0.73.0`,
  `react >=18.2.0`). A new RN release installs without `ERESOLVE`, so consumers
  do not wait for a package release. Contract tests reject a capped peer.
- CI builds archive consumers for the two newest releases on every PR and for the
  window boundaries weekly: the 0.76 floor, the React 19 switch (0.78) and the
  removal of the Old Architecture (0.82).
- A weekly [release monitor](#release-monitor) fails when npm `latest` is newer
  than the newest lane. The maintainer then runs both lanes for that release and
  adds it to the matrix.
- Between an RN release and its lane, that release is supported but not yet
  CI-verified. Regressions are bugs against this package, not an unsupported
  configuration.

Peer versions 0.73–0.75 and the Old Architecture remain best effort with
historical evidence only. A future release that removes an API the package uses
would be handled as a bug fix, not by capping the peer range.

## Matrix and qualification

`Native compatibility` adds independent checks without altering the JavaScript
workflow. `scripts/native-ci/matrix.json` is the explicit, exact-version policy.
Each lane also records the Android SDK packages and macOS runner/Xcode that its
RN template expects, so old releases build with a contemporary toolchain.

| Selection | RN (Android and iOS) | Trigger |
| --- | --- | --- |
| `stable` | 0.88.0, 0.87.1 | Every PR, main push, manual |
| `window` | 0.82.1, 0.78.3, 0.76.9 | Manual |
| `support` | `stable` + `window` | Weekly schedule, manual; run before a release |
| `anchor` | 0.85.3 (example) | Manual only |

| Lanes | Android SDK / NDK | iOS runner / Xcode |
| --- | --- | --- |
| 0.88.0, 0.87.1 | SDK 37.0, build-tools 37.0.0, NDK 27.1 | `macos-26` / 26.6 |
| 0.85.3, 0.82.1 | SDK 36, build-tools 36.0.0, NDK 27.1 | `macos-26` / 26.6 |
| 0.78.3 | SDK 35, build-tools 35.0.0, NDK 27.1 | `macos-15` / 16.4 |
| 0.76.9 | SDK 35, build-tools 35.0.0, NDK 26.1 | `macos-15` / 16.4 |

RN 0.76/0.78 iOS lanes use Xcode 16.4 because those releases' bundled `fmt` does
not compile with newer Apple clang: local RN 0.76.9 and 0.78.3 consumers failed
in `fmt/format.cc` with a `consteval` error on Xcode 27.0, before any package
source was compiled. This upstream RN/Xcode limit also affects apps that do not
use this package.

All selected native jobs must succeed. The final aggregate check fails if
contracts, Android, or iOS fail, skip, or cancel. `stable` and `support` publish
`Required native compatibility`; partial selections publish
`Native compatibility (window)` or `Native compatibility (anchor)` and never
certify the stable matrix. Repository branch protection is not changed by these
files; a maintainer can select `Required native compatibility` after an actual
GitHub run.

### 2.0.1 release CI

Release source [`d903b83`](https://github.com/marcocrupi/react-native-keep-awake-plus/commit/d903b8312c4d6a5c89580f2690ac3fdefb0543e3)
passed on 2026-10-16:

- [JavaScript CI 38872926349](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38872926349).
- [Stable native CI 38872926109](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38872926109): RN 0.88.0 and 0.87.1, Android/iOS.
- [Full support CI 38872926030](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38872926030): all ten platform/version lanes, contracts, release monitor and required aggregate passed.

The public npm 2.0.1 archive has SHA-256
`d04655dd62f3959665041d8911e59c1be2aca10edd5f2b49ca2c479a4896e1fe`.
Retained CI archives from Android RN 0.88.0 and iOS RN 0.88.0/0.76.9 match
those published bytes and every member hash. The registry download and a fresh
RN 0.88.0 consumer also match the archive and lock integrity. The release tag
remains at the source commit; this evidence update is later documentation.
These checks establish builds and host tests, not OS runtime qualification.

### 2.0.1 local lane evidence

Before the 2.0.1 commit, on 2026-10-16, unchanged `lane.cjs` runs on a local
macOS host (Xcode 27.0, JDK 17, Node 24.14.1 / npm 11.11.0) produced:

| RN | Android | iOS (Xcode 27.0) |
| --- | --- | --- |
| 0.88.0 | PASS: AGP 9.2.1, 44/44 host tests, Debug/Release | PASS: `ReactCodegen/` header, class and SpecJSI linked |
| 0.87.1 | PASS: AGP 9.2.1, 44/44 host tests, Debug/Release | Not rerun locally (unchanged iOS source; PR CI lane) |
| 0.82.1 | PASS: AGP 8.12.0, 44/44 host tests, Debug/Release | PASS: class linked |
| 0.78.3 | PASS: AGP 8.8.0, 44/44 host tests, Debug/Release | FAIL upstream: `fmt` `consteval`; package not reached |
| 0.76.9 | PASS: AGP 8.6.0, 44/44 host tests, Debug/Release | FAIL upstream: `fmt` `consteval`; package not reached |

Every lane installed its archive with plain `npm install`. The iOS
Objective-C++ source was byte-identical in all of them. The 0.88.0 lanes and
Android 0.76.9 ran before the version bump and the explanatory comment in
`KCKeepAwakePackage.java`. They tested the same code without that comment. The
other lanes packed the 2.0.1 sources.

As a **diagnostic only**, `fmt/base.h` in the disposable RN 0.76.9 and 0.78.3
consumers was patched to disable `consteval`, then rebuilt. Both apps compiled
the package without warnings and linked `ReactNativeKCKeepAwake` and
`NativeKCKeepAwakeSpecJSI`. This is not lane evidence: the qualifying 0.76/0.78
iOS lanes are the CI `macos-15` / Xcode 16.4 runs. Logs and `result.json` files
were kept outside the repository and were not committed.

### Historical 2.0.0 stable run

The 2.0.0 implementation commit
[`71cb67772c43cdebf265df74f274d1ad9c6132d5`](https://github.com/marcocrupi/react-native-keep-awake-plus/commit/71cb67772c43cdebf265df74f274d1ad9c6132d5)
passed the then-stable matrix (RN 0.86.3 and 0.87.1) on 2026-10-15:
[Native compatibility run 38769209447](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38769209447)
completed contracts, both Android lanes, both iOS lanes and the final required
check. [JavaScript run 38769209285](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38769209285)
also passed. The stable run does not establish a manual anchor run, emulator,
simulator runtime or physical-device execution. Documentation-only revisions
change archive bytes; these runs identify the implementation commit they tested.

## Peer range, anchor and historical evidence

| Category | Scope | Interpretation |
| --- | --- | --- |
| npm peers | RN `>=0.73.0`, React `>=18.2.0`, no upper bound | Resolver range, not exhaustive qualification |
| Supported | Every stable RN release from 0.76, New Architecture | [Support policy](#support-policy) |
| Stable CI | RN 0.88.0 and 0.87.1, Android/iOS New Architecture | Every PR and main push |
| Support window CI | RN 0.82.1, 0.78.3 and 0.76.9, Android/iOS New Architecture | Weekly and manual `support` runs |
| Regression anchor | RN 0.85.3, example and manual anchor selection | Not automatically included in stable CI |
| Historical RN 0.73.11 | Android Old Architecture build/runtime; Android New Architecture Codegen/build; iOS Pods/build; lint and root/Class smoke | Recorded in the 1.5.0 changelog; not a current CI lane or a new 2.0.0 runtime pass |
| RN 0.73–0.75 / Old Architecture | Bridge sources retained where RN permits them | Best effort; not individually qualified |

The example remains RN 0.85.3. Root RN 0.86.0 is tooling, not a stable lane.
New Architecture is required by the qualified modern RN templates. Retained
bridge sources do not imply that modern RN can run Old Architecture.

## Runtime evidence and limits

The local 2.0.0 technical campaign and independent review recorded separate
RN 0.87.1 New Architecture runtime checks:

| Layer | Verified scope | What it does not prove |
| --- | --- | --- |
| JavaScript/Jest | Owner identity, enabled transitions, StrictMode replay, cleanup and synchronous errors with controlled native calls | Actual OS flag changes |
| Android host | Lifecycle/regression/deadlock tests | Emulator or physical-device behavior |
| Android local runtime | API 36 emulator, Release app; 32 mixed-owner phases with three OS Window flag observations each | Physical hardware, all Android versions, background execution |
| iOS local runtime | iOS 26.5 simulator, Debug native app with production JS bundle; 95 main-thread UIKit reads over 33 phases | Physical devices, store signing, every iOS release |
| iOS historical lifecycle campaign | RN 0.85.3/0.87.1 isolated RCTHost/teardown and native UIKit-host witnesses | A fresh 2.0.0 run of every lifecycle scenario |

Local runtime/build checks used an initial 2.0.0 archive before a final packaging
change. The independent review proved identical production JS/native/type/build
inputs in the final archive; only changelog/allowlist metadata and removal of an
unused Gradle fixture differed. The final archive was reinstalled and its bytes,
lock integrity, types and autolinking checked. Runtime PASS therefore rests on
**production-input equivalence**, not a fresh build/run of the final container.
Maintainer provenance is recorded in [release readiness](release-readiness.md).

The native coordinators preserve requests from other valid native module
instances/runtimes. Android retains desired state across Activity changes and
serializes Window reconciliation. iOS serializes idle-timer reconciliation on
the main queue. Invalidation is terminal and revokes ownership; queued work
cannot grant a revoked runtime new authority. These are implementation/tested
contracts, not a promise of immediate synchronous OS cleanup or isolation from
external flag writers. There is no public OS-state getter.

Same-process iOS scene disconnection/reconnection, physical-device qualification,
store signing and all peer/OS combinations remain **NOT RUN / unqualified**.
No simulator build alone is described as runtime validation.

## iOS integration

The package supplies a TurboModule spec in `NativeKCKeepAwake.ts`. Consumer
Codegen produces the generated interfaces during the RN build/Pods process;
the archive contains sources, not generated products. The podspec uses RN's
`min_ios_version_supported` and `install_modules_dependencies`, with ARC and
RN-managed native dependencies. Check the consuming RN version's minimum OS and
helpers; the old iOS 8 declaration is not a current support promise. The inspected
RN 0.85.3 example and RN 0.87.1 consumer helpers declare iOS 15.1 as their
minimum. That build requirement does not establish runtime coverage on iOS 15.1.

The example uses UIScene configuration in its plist and AppDelegate/SceneDelegate.
This is example application lifecycle setup, not an extra scene delegate that
consumers must copy into every app. Module invalidation/deallocation and actual
TurboModule teardown have separate evidence from a scene reconnect in one process.
See the [iOS lifecycle harness](../ios/tests/README.md) for its host requirements
and qualification boundaries.

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

AGP 9 and its new DSL are different contracts. The qualified RN 0.87.1 and 0.88.0
AGP 9 configurations retain `android.newDsl=false` and `android.builtInKotlin=false`,
as the official template does. The new DSL is not qualified by this matrix.

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

The recorded local probe used a fresh official RN 0.87.1 / CLI 20.1.3 consumer with a
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
records the probe's actual outcome; the probe did not patch the RN template or
change the stable matrix.

## Runners, cost and reproducibility

Node 24.14.1 / npm 11.11.0 and Java 17 are pinned. Android uses `ubuntu-24.04`
and installs exactly the SDK platform, build tools and NDK listed for its lane in
`matrix.json`. iOS uses the lane's standard arm64 image (`macos-26` or
`macos-15`) and `/Applications/Xcode_<lane xcode>.app`; missing Xcode fails
immediately. Runner OS, SDKs, Xcode and actual versions are logged. Provisioning
profiles, device signing, larger runners and paid runner labels are unnecessary.

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
heavy duplicate builds. iOS compiles Debug only. Pull requests run the two
`stable` lanes; the three older `window` lanes run weekly or on demand, so the
whole support window is rebuilt at least once a week without slowing every PR.
Anchor builds are opt-in. Artifacts expire in 7 days. Existing JS checks
continue independently.

## Release monitor

The weekly scheduled run (and every manual run) starts
`scripts/native-ci/release-monitor.cjs`. It reads the `react-native` npm
dist-tags and fails when `latest` is newer than the newest stable lane
(`stable[0]`), logging `next` for information. A failed scheduled run is the
notification. The monitor is not part of `Required native compatibility`, so an
upstream release never fails a pull request.

The monitor never edits the matrix. To add a release:

1. Prepare a local candidate update: add the exact version to `stable` and
   `lanes` in `matrix.json`, including its SDK and Xcode toolchain, and keep the
   two newest releases in `stable`. Move a superseded boundary release to
   `window` only if it marks a new upstream transition. Update the contract
   expectations and compatibility tables in the same candidate.
2. Run `lane.cjs android` and `lane.cjs ios` for that exact version, using the
   SDK and Xcode its template expects. The script accepts only versions already
   present in the candidate matrix.
3. Promote the update only after both lanes pass and the candidate has a green
   `stable` CI run. Adding a matrix entry alone does not establish qualification.

If a release breaks the package, fix the package. Do not cap the peer range.

## Local reproduction

Use the pinned Node/npm, Android SDK/Java for Android, or macOS/Xcode/CocoaPods
for iOS. Consumer/artifact directories must be new absolute paths outside the
checkout. Native jobs are reproducible independently:

```sh
node --test scripts/native-ci/contracts.test.cjs
node scripts/native-ci/release-monitor.cjs
node scripts/native-ci/lane.cjs android 0.88.0 /tmp/keep-awake-android-0880
node scripts/native-ci/lane.cjs ios 0.88.0 /tmp/keep-awake-ios-0880
node scripts/native-ci/lane.cjs android 0.76.9 /tmp/keep-awake-android-0769
node scripts/native-ci/lane.cjs android 0.85.3 /tmp/keep-awake-anchor-android
```

Every version in `stable`, `window` and `anchor` is accepted. Older iOS lanes
need the Xcode named in `matrix.json` (`DEVELOPER_DIR`); for example, RN 0.76.9
and 0.78.3 do not compile with Xcode 27.

Run the optional real npm/Codegen/javac negative witnesses only
against a completed disposable Android lane (never the checkout/example):

```sh
node scripts/native-ci/negative-witness.cjs /tmp/keep-awake-android-0880 /tmp/keep-awake-negative
```

The witness restores mutated archive sources in `finally` and verifies byte
identity; a successful mutation fails the witness. After negative experiments,
revalidate using a fresh `lane.cjs` workspace. These scripts create and modify disposable consumers; they do not edit the
checkout's source/dependency files or perform commits, pushes, releases or remote
dispatches.
