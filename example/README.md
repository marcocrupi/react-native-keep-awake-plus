# Keep Awake Plus example

A focused smoke app for the repository's 2.0.0 API, using **React Native 0.85.3**
and React 19.2.3. It is the regression anchor, separate from stable RN
0.86.3/0.87.1 native CI. Read the [library guide](../README.md) and
[migration guide](../MIGRATION.md) for public API behavior.

## Requirements

- Node **>=22.11.0** (the JS workflow uses 22.23.3), npm and the committed locks.
- Android SDK/NDK and Java compatible with the RN 0.85.3 template, plus an
  emulator or connected test device. Java 17 is the native CI baseline.
- For iOS: macOS, compatible Xcode/iOS simulator, Ruby >=3.1.0, Bundler and
  CocoaPods satisfying [Gemfile](Gemfile). Native CI uses CocoaPods 1.16.2.
- Complete the RN [environment setup](https://reactnative.dev/docs/set-up-your-environment)
  for the platform you intend to run. Keep New Architecture enabled.

The app supports native Android/iOS builds; Expo Go is not a host for this module.

## Clean installation

From the repository root:

```sh
npm ci
cd example
npm ci
npm config get install-links
```

The last command must print `true`. [package.json](package.json) depends on the
library through `file:..`. [.npmrc](.npmrc) sets `install-links=true`, so npm packs
and physically installs the package instead of making a source symlink. This
avoids local dependency discovery/Codegen issues and tests the package contents.
Do not bypass peer validation with `--force` or `--legacy-peer-deps`.

After editing package-root files, rerun `npm ci` from `example/` to refresh this
installed copy. Fast Refresh alone cannot refresh a stale physical package copy.
Native source or dependency changes also need Pods/native rebuilds. Keep
installation/generated output out of source control.

## Run Android

From `example/`, start Metro:

```sh
npm start
```

In another terminal, from `example/`, start an emulator or connect your chosen
test device, then run:

```sh
npm run android
```

If several devices are connected, select the intended device using your installed
CLI's device options (`npx react-native run-android --help`). Verify the target
before interacting with personal hardware.

## Run iOS

From `example/`, install Ruby dependencies, then Pods from `ios/`:

```sh
bundle install
cd ios
bundle exec pod install
cd ..
```

Keep Metro running in a separate terminal and run from `example/`:

```sh
npm run ios
```

You can also open `ios/KeepAwakePlusSmoke.xcworkspace` in Xcode after installing
Pods. Select an available simulator; device signing is a separate local setup.
The example uses UIScene; it does not qualify same-process scene reconnection.

## Use the smoke interface

There is one scrollable smoke screen in [App.tsx](App.tsx), initially with all
requests disabled. Its controls exercise these behaviors:

| Control | Effect |
| --- | --- |
| Component owner A / B | Independently mounts/unmounts a default component owner |
| Hook owner A / B | Independently mounts/unmounts a child calling `useKeepAwake()` |
| Conditional hook + component enabled | Toggles two mounted owners with the same `enabled` value |
| Acquire token | Holds one token in a ref; repeated presses do not acquire more |
| Release token | Consumes that token; repeated presses are harmless |
| Activate imperative | Acquires the single root implicit request, idempotently |
| Deactivate imperative | Releases only that root request, idempotently |

`owner state` shows the four mounted A/B children. `lastAction`, `lastError` and
`[KeepAwakeSmoke]` logs record actions/errors; none is an OS-state readout. The
conditional and token state are not included in the four A/B status rows.
Token cleanup runs on App unmount. The root imperative request is deliberately
controlled by its buttons: press Deactivate when finished; do not rely on App
unmount to release it. A full runtime reload creates a new ownership scope.

### Manual ownership sequence

1. Begin with all switches off; press Release token and Deactivate imperative.
2. Enable Component A and Hook B; remove A. B should retain its request.
3. Enable the conditional switch, then remove B. The conditional owners remain.
4. Acquire the token twice, then disable the conditional switch. One token remains.
5. Activate imperative twice; release the token twice. The root request remains.
6. Deactivate twice. No app owner remains; native deactivation should be requested.
7. Repeat with the order reversed to check that one owner cannot release another.

Observe Android `FLAG_KEEP_SCREEN_ON` or iOS `UIApplication.idleTimerDisabled`
independently when qualifying runtime. Screen-sleep observation is a useful smoke
check, but labels and JS logs alone do not prove OS state. This app does not expose
an OS getter. The UI does not exercise Class statics or multiple independent
tokens; Jest covers those cases, and separate external runtime campaigns used a
richer harness. Do not claim those UI controls exist here.

## JavaScript checks

From the repository root:

```sh
npm run typecheck
npm run check:package
cd example
npm run typecheck
npm run lint
npm test -- --runInBand
```

Jest uses controlled native calls for ownership/error regression tests; it does
not run an emulator, simulator or native module. Lint fails on warnings. See
[native compatibility](../docs/native-compatibility.md) for fresh archive-consumer
native build reproduction and the [iOS harness](../ios/tests/README.md) for
separate lifecycle witnesses.

## Troubleshooting

- **Stale API or missing `enabled`/tokens:** rerun `npm ci` in `example/` and rebuild
  if native inputs changed; verify the physical installed package is 2.0.0.
- **Native module unavailable:** check autolinking, install Pods on iOS and rebuild
  the app. Metro restart alone does not add native modules.
- **Codegen cannot find the local package:** confirm `install-links=true` and that
  `node_modules/@marcocrupi/react-native-keep-awake-plus` is a directory, not a link.
- **Still awake after deactivate:** check every switch/token and root request.
  Deactivate is not a global override in 2.0.0.
- **CocoaPods helper/header error:** use this app's RN installation and run Pods
  from `example/ios`, not the repository root; inspect the first Codegen error.
- **Gradle/SDK error:** use RN 0.85.3's toolchain and app SDK policy. Do not infer
  that this anchor uses the separate RN 0.87.1 AGP 9 template configuration.

Development-tooling audit findings are tracked in
[release readiness](../docs/release-readiness.md); they are not hidden by these
commands. This example and its diagnostics are excluded from the npm package.
