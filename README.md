# React Native Keep Awake Plus

`@marcocrupi/react-native-keep-awake-plus` is a React Native library for
preventing the screen from going to sleep while your app is active.

It is an independently maintained fork by Marco Crupi, based on the original
work by Kyle Corbitt and Sayem Chowdhury.

## Project status

The New Architecture native CI matrix covers **React Native 0.86.3 and 0.87.1
on Android and iOS**, with 0.85.3 as a separate manual regression anchor.
[Native compatibility](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md) describes the evidence and
limits. The baseline [native run](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38753921648)
and [JavaScript run](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38753921594)
passed at `0d4fbfa` on 2026-10-15. These remote results cover that commit;
subsequent local changes require their own validation.

The local release candidate is **2.0.0**. Imperative calls now share ownership
with hooks, components and tokens: deactivate releases only its own request.
This intentionally replaces the previous last-call-wins behavior. Read the
[1.6.1 → 2.0.0 migration guide](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/MIGRATION.md) and the
[release checklist](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/release-readiness.md).

## About this fork

`@marcocrupi/react-native-keep-awake-plus` is an independently maintained
fork of `@sayem314/react-native-keep-awake`.

The original project was created by Kyle Corbitt and later maintained by Sayem
Chowdhury. This fork is maintained by Marco Crupi.

The goal of this fork is to keep the package usable for current React Native
projects while preserving the original public API where possible. The original
MIT license and copyright notices are preserved.

This fork is not affiliated with or endorsed by the original maintainers unless
they state otherwise.

## Installation

Install the package with npm:

```sh
npm install @marcocrupi/react-native-keep-awake-plus
```

Or with Yarn:

```sh
yarn add @marcocrupi/react-native-keep-awake-plus
```

For iOS, run `pod install` in the app's `ios` directory after installing the
package. Autolinking and the app's React Native Codegen generate the native
spec; generated sources are not shipped by this package. Rebuild the native app
after installation. Expo projects need a native development build; Expo Go does
not include this module.

On Android use the SDK, NDK, JDK and Gradle versions required by your React Native
template. The library inherits `rootProject.ext.compileSdkVersion` and
`rootProject.ext.minSdkVersion`; missing values fail explicitly. It uses the
consumer's Android/React Native plugins and needs no extra manifest permission.
Keep New Architecture enabled. For RN 0.87.1 / AGP 9, retain the template's
`android.newDsl=false` and `android.builtInKotlin=false`: enabling both is
[blocked upstream](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md#agp-9-new-dsl-probe).

The podspec uses React Native's `min_ios_version_supported` and
`install_modules_dependencies` helpers. RN 0.85.3 and 0.87.1 require iOS 15.1.
Consumers on older React Native versions must use their version's supported
iOS minimum and provide these CocoaPods helpers; the previous iOS 8.0
declaration is no longer retained. This packaging validation does not extend
the npm peer dependency range or qualify other React Native versions.

## Usage

### Hook

```js
import { useKeepAwake } from '@marcocrupi/react-native-keep-awake-plus';
import React from 'react';
import { Text, View } from 'react-native';

export default function KeepAwakeExample() {
  useKeepAwake();

  return (
    <View>
      <Text>This screen will stay awake while this component is mounted.</Text>
    </View>
  );
}
```

### Component

```js
import KeepAwake from '@marcocrupi/react-native-keep-awake-plus';
import React from 'react';
import { Text, View } from 'react-native';

export default function KeepAwakeExample() {
  return (
    <View>
      <KeepAwake />
      <Text>This screen will stay awake while KeepAwake is mounted.</Text>
    </View>
  );
}
```

### Conditional ownership

```tsx
// Pass focus or another boolean from your app; no navigation dependency needed.
function FocusedScreen({ isFocused }: { isFocused: boolean }) {
  useKeepAwake({ enabled: isFocused });
  return null;
}

// Equivalent component API:
<KeepAwake enabled={isFocused} />;
```

Import `useKeepAwake` or `KeepAwake` as shown above. Omitted options or `enabled`
default to `true`. `false` acquires no owner; switching to `true` acquires one,
and switching back or unmounting releases it. Changing only the options object
does not reacquire. React StrictMode effect replay balances setup and cleanup.

### Independent task owners

```js
import { acquireKeepAwake } from '@marcocrupi/react-native-keep-awake-plus';

async function uploadWithScreenAwake() {
  const release = acquireKeepAwake();
  try {
    await upload(); // your operation
  } finally {
    release();
  }
}
```

Each acquisition returns an independent `() => void` release. Call it on every
completion/cancellation path; repeated release calls are harmless. Tokens share
ownership with enabled hooks/components and mounted legacy Class instances.
Acquiring during render is unsafe: use an effect or event/task handler.

Native activation errors propagate without retaining an owner. Final native
deactivation errors also propagate, but the release is consumed and cannot
release another owner; report the error in your app. Hooks follow React's effect
error handling. Successful calls request native state asynchronously; they do
not confirm the OS flag. Runtime invalidation revokes native ownership and stale
callbacks cannot reactivate that runtime; handles do not transfer to a new
runtime. There is no public asynchronous OS-status API.

### Imperative functions

```js
import {
  activateKeepAwake,
  deactivateKeepAwake,
} from '@marcocrupi/react-native-keep-awake-plus';
import React from 'react';
import { Button, View } from 'react-native';

export default function KeepAwakeExample() {
  return (
    <View>
      <Button title="Activate" onPress={activateKeepAwake} />
      <Button title="Deactivate" onPress={deactivateKeepAwake} />
    </View>
  );
}
```

## Multi-owner behavior

The component, hook, legacy Class instances and `acquireKeepAwake()` share one
JavaScript owner count per loaded package instance/runtime. Native activation is
requested on the first owner and deactivation on the last release. Disabled
owners do not count. Native coordinators preserve requests from other valid
React Native runtimes. Android reconciles the current Activity/window after
lifecycle changes; iOS serializes idle-timer reconciliation on the main queue.
This prevents automatic screen sleep; it does not unlock the device, hold a CPU
wake lock, or keep background work running. Other code changing the same OS flag
can interfere. Same-process iOS scene reconnection remains unqualified.

## Imperative behavior

All public keep-awake APIs use the same coordinator within one JavaScript runtime.
Native activation is requested when the first owner acquires; deactivation is
requested when the last owner releases. Releasing one owner preserves all others.

`activateKeepAwake()` holds **one implicit root request**. Calling it repeatedly
does not create extra owners. `deactivateKeepAwake()` releases only that request;
repeated calls, including calls before activation, do nothing. Use
`acquireKeepAwake()` for multiple independent imperative tasks.

```js
const release = acquireKeepAwake();
activateKeepAwake();
activateKeepAwake(); // still one root request
deactivateKeepAwake(); // token keeps the native request active
release(); // last owner: request native deactivation
```

The `/Class` and `/Class.js` deep imports refer to the same legacy class. Each
mounted instance owns its own request. `Class.activate()` / `Class.deactivate()`
hold a **separate implicit Class request**, distinct from the root functions and
from instances. Both method families are idempotent; pair activation and
deactivation within the same family. Static deactivate cannot release an
instance, token, hook, component or root request. The root hook/component provide
conditional `enabled`; the legacy class does not.

This is a **2.0.0 breaking change** from imperative last-call-wins. There is no
public force-off operation. Native code preserves ownership across runtimes;
the JavaScript coordinator only coordinates its own runtime/module instance.

### React Navigation

Navigation is optional. If your app already uses React Navigation, keep an owner
only while focused (screens can remain mounted while blurred):

```tsx
import {useIsFocused} from '@react-navigation/native';
import {useKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

function VideoScreen() {
  const isFocused = useIsFocused();
  useKeepAwake({enabled: isFocused});
  return null; // your player
}
```

Alternatively, return `acquireKeepAwake()`'s release from your app's focus effect.
Pass focus as a boolean prop when no navigation library is installed. Call hooks
unconditionally; control ownership with `enabled`.

## React Native 0.85.3 smoke app

The repository includes a smoke app in `example/` targeting React Native
0.85.3. It uses npm, depends on this package through
`@marcocrupi/react-native-keep-awake-plus: "file:.."`, and enables
`install-links=true` in `example/.npmrc`.

The `install-links=true` setting avoids installing the local `file:..`
dependency as a symlink. This matters because React Native Codegen may not
process the package root correctly when the local dependency is symlinked.

Common example commands:

```sh
cd example
npm install
npm test
npm run android
npm run ios
```

## Compatibility

Declared peer ranges are React `>=18.2.0 <20.0.0` and React Native
`>=0.73.0 <0.88.0`. They allow installation; they do not certify every version.

| Versions | Architecture | Evidence |
| --- | --- | --- |
| RN 0.86.3, 0.87.1 | New Architecture | Android Debug/Release + lifecycle host tests, iOS simulator build in baseline native CI |
| RN 0.85.3 | New Architecture | Included smoke app, historical runtime checks; separate manual CI regression anchor |
| RN 0.73.11 | Old and New Architecture | Historical disposable-consumer validation, not a current CI lane |
| Other versions within peers | New Architecture first; Old best effort where RN permits | Not individually qualified |

The example stays on RN 0.85.3; root RN 0.86.0 is tooling, not a matrix lane.
Old Architecture support is best effort and retains bridge sources. RN versions
that require New Architecture cannot be used to qualify Old Architecture.
[Compatibility details](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md) distinguish build, host,
runtime and release evidence, including the AGP 9 new DSL limitation.

Non-native environments expose the same optional arguments and an idempotent
no-op release. They provide no browser wake-lock functionality. Missing native
modules stay import-safe and fail explicitly when an acquisition requires native
activation. Deactivation without an implicit request is a no-op, even when the
native module is missing. The root fallback has no native side effects; legacy
Class deep imports are native entrypoints and are not a browser fallback.

## Security

SEC-01 is closed with a documented residual tooling risk, not a claim of zero
vulnerabilities. Root/example audits on 2026-10-15 still report
[`braces` GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
through development tooling; no compatible upstream remediation was confirmed.
The package ships no runtime npm dependencies. Recheck the actual development
and consumer graphs before release; do not suppress audit findings or infer
consumer safety from this repository's audit. See the release checklist.

### Native naming compatibility

This package is intended to be used as a replacement for
`@sayem314/react-native-keep-awake`, not alongside it in the same React Native
app.

Although the npm package name is
`@marcocrupi/react-native-keep-awake-plus`, the native iOS and Android layers
still keep legacy identifiers inherited from the original package, including
the iOS pod name, native module name, Codegen name, and Android package.

Installing both packages in the same app is not supported and may cause
CocoaPods, native module, Codegen, or Android package collisions. Apps should
depend on one keep-awake package only.

## Development notes

Use `example/` for local development and smoke checks. After changing files in
the package root, run `cd example && npm install` when you need to refresh the
example app's installed local copy.

Jest owner-counting tests live in `example/__tests__`. The manual multi-owner
smoke UI lives in `example/App.tsx`.

## License

This project is available under the MIT license.

## Credits

Original project:

- Kyle Corbitt
- Sayem Chowdhury

Fork maintainer:

- Marco Crupi
