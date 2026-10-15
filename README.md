# React Native Keep Awake Plus

Prevent automatic screen sleep while your React Native app needs an active screen.
`@marcocrupi/react-native-keep-awake-plus` supports Android and iOS, with hooks,
a component and independent task handles backed by shared ownership.

This guide describes **2.0.0**. Upgrading from 1.x? Read the
[migration guide](MIGRATION.md) for the shared-ownership behavior and breaking
changes. Maintainers track publication separately in the
[release checklist](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/release-readiness.md).

- Keep awake while mounted, focused or enabled by app state.
- Overlapping screens and tasks hold independent requests.
- Idempotent task cleanup and imperative calls.
- TypeScript declarations, React Native autolinking and New Architecture Codegen.

[Installation](#installation) · [Quick start](#quick-start) · [API reference](#api-reference) ·
[Ownership](#ownership-model) · [React Navigation](#react-navigation) ·
[Troubleshooting](#troubleshooting) · [Maintainer guides](#testing-and-compatibility-evidence)

## Installation

Install 2.0.0 with either package manager:

```sh
npm install @marcocrupi/react-native-keep-awake-plus@2.0.0
```

```sh
yarn add @marcocrupi/react-native-keep-awake-plus@2.0.0
```

The commands pin the version covered by this guide. To work from a local checkout,
follow the [example guide](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/example/README.md).

React Native autolinks the native module. On **Android**, rebuild the app; no
manual package registration or extra manifest permission is needed in a standard
autolinked project. Use the SDK, NDK, Java and Gradle versions required by your RN
template. The library reads the consumer's `compileSdkVersion` and `minSdkVersion`
from `rootProject.ext`; it does not set the application's target SDK.

On **iOS**, install Pods and rebuild the native app:

```sh
cd ios
bundle exec pod install
cd ..
```

Use `pod install` if your project does not manage CocoaPods with Bundler. The app's
React Native CocoaPods setup must provide `min_ios_version_supported` and
`install_modules_dependencies`. The podspec inherits that RN minimum; it does not
promise support for every iOS release. Codegen runs in the consumer build;
generated sources are not shipped.

Keep **New Architecture** enabled for the qualified RN versions. Legacy bridge
sources remain for older RN versions that allow Old Architecture, with historical
coverage only. RN 0.87.1 / AGP 9 uses the official template settings
`android.newDsl=false` and `android.builtInKotlin=false`; true/true is
[not qualified](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md#agp-9-new-dsl-probe).

**Expo:** Expo Go does not contain this native module. Use a native development
build and regenerate/rebuild the native app after installation. This repository
does not qualify a specific Expo SDK.

**Replacement package:** remove `@sayem314/react-native-keep-awake` before using
this fork. Native module, pod, Codegen and Android package identifiers retain the
original names. Installing both packages can cause native collisions.

## React Native compatibility

| Scope | Versions and evidence |
| --- | --- |
| npm peers | React `>=18.2.0 <20.0.0`; RN `>=0.73.0 <0.88.0` (installation range) |
| Stable native CI | RN **0.86.3, 0.87.1**, Android/iOS **New Architecture** |
| Regression anchor | RN **0.85.3**, included example and separate manual CI selection |
| Historical evidence | RN **0.73.11**, selected Old/New Architecture checks |

The peer range is broader than the versions qualified by CI. Old Architecture is
best effort where RN permits it. Root RN 0.86.0 is development tooling, not a
qualified matrix lane. See [native compatibility](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md)
for build, host-test and runtime boundaries.

## Quick start

Keep the screen awake while this screen is mounted:

```tsx
import React from 'react';
import {Text, View} from 'react-native';
import {useKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

export default function ReadingScreen() {
  useKeepAwake();
  return <View><Text>The screen stays awake while reading.</Text></View>;
}
```

Or mount the default component in JavaScript or TSX:

```jsx
import React from 'react';
import {Text, View} from 'react-native';
import KeepAwake from '@marcocrupi/react-native-keep-awake-plus';

export default function ReadingScreen() {
  return <View><KeepAwake /><Text>Reading</Text></View>;
}
```

Unmounting releases that component's request. Other active owners remain active.

## API reference

All functions are synchronous from JavaScript's perspective. Their return values
acknowledge JavaScript ownership, not the operating system's observed flag.

| API | Parameters | Returns | Behavior / use case |
| --- | --- | --- | --- |
| `useKeepAwake()` | None | `void` | Owns a request from effect setup until cleanup |
| `useKeepAwake({enabled})` | Optional options; `enabled?: boolean`, default `true` | `void` | Owns a request only while mounted and enabled |
| `<KeepAwake />` | None | Renders `null` | Declarative owner for its mounted lifetime |
| `<KeepAwake enabled={value} />` | `enabled?: boolean`, default `true` | Renders `null` | Conditional declarative owner |
| `acquireKeepAwake()` | None | `() => void` | Acquires an independent task owner; returned release is idempotent |
| `activateKeepAwake()` | None | `void` | Acquires the single implicit root request, idempotently |
| `deactivateKeepAwake()` | None | `void` | Releases only the implicit root request; absent request is a no-op |
| Legacy `<LegacyKeepAwake />` | No keep-awake options | Renders `null` | Each mounted Class instance owns an independent request |
| `LegacyKeepAwake.activate()` | None | `void` | Acquires the separate implicit Class request, idempotently |
| `LegacyKeepAwake.deactivate()` | None | `void` | Releases only the implicit Class request, idempotently |

Only the component is a default root export. The hook and functions are named
exports. `KeepAwakeOptions` and `KeepAwakeProps` are TypeScript types with an
optional boolean `enabled`. Legacy Class is a default deep import from `/Class`
or `/Class.js`; both paths resolve to the same Class family.

### Conditional workout screen

Call hooks on every render; change `enabled` instead of calling a hook conditionally.
This complete example keeps the screen awake during a timed workout:

```tsx
import React, {useEffect, useState} from 'react';
import {Button, Text, View} from 'react-native';
import {useKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

export default function WorkoutScreen() {
  const [remaining, setRemaining] = useState(0);
  const running = remaining > 0;
  useKeepAwake({enabled: running});

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setRemaining(n => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  return (
    <View>
      <Text>{remaining} seconds remaining</Text>
      <Button title="Start 60 seconds" onPress={() => setRemaining(60)} />
      <Button title="Stop" onPress={() => setRemaining(0)} />
    </View>
  );
}
```

The equivalent component expression is `<KeepAwake enabled={running} />`, with
`KeepAwake` imported as the default export. Omitting `enabled` means `true`.
Switching to false or unmounting releases the owner; switching back acquires a new
one. Recreating the options object alone does not reacquire. StrictMode effect
setup/cleanup replay balances ownership. This example is a foreground UI timer;
keep-awake does not make timers accurate or runnable in the background.

### Asynchronous operation with a token

Use one acquisition per operation, including overlapping operations. This helper
accepts your operation and returns its result; cancellation must settle the
operation so `finally` runs:

```ts
import {acquireKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

export async function withScreenAwake<T>(operation: () => Promise<T>): Promise<T> {
  const release = acquireKeepAwake();
  try {
    return await operation();
  } finally {
    release();
  }
}
```

Acquire from an effect or event/task handler, never during render. Always clean up
on completion, failure and cancellation. A release error propagates from `finally`
and can replace an operation error; applications needing both errors should
capture/report them separately. The token does not cancel the operation.

### Multiple owners and idempotent imperative calls

This JavaScript example needs no React component. Run it with no existing owners
to observe the first/last-owner transitions described in the comments:

```js
import {
  acquireKeepAwake,
  activateKeepAwake,
  deactivateKeepAwake,
} from '@marcocrupi/react-native-keep-awake-plus';

export function demonstrateOwners() {
  const releaseWorkout = acquireKeepAwake(); // first owner: native activate
  try {
    const releaseUpload = acquireKeepAwake();
    try {
      activateKeepAwake();
      activateKeepAwake(); // one implicit root request, not two
      deactivateKeepAwake(); // both task owners remain
      deactivateKeepAwake(); // no-op
    } finally {
      try {
        deactivateKeepAwake(); // safe even if activation failed
      } finally {
        releaseUpload(); // workout remains
        releaseUpload(); // no-op
      }
    }
  } finally {
    releaseWorkout(); // last owner: native deactivate
  }
}
```

The implicit root request suits a single application-controlled switch. Use tokens
when independent callers need independent cleanup. Pair root activation with root
deactivation; do not mix it with Class static methods.

### Legacy Class

```tsx
import React from 'react';
import LegacyKeepAwake from '@marcocrupi/react-native-keep-awake-plus/Class';

export default function LegacyScreen() {
  return <LegacyKeepAwake />;
}

export function startLegacyRequest(): void {
  LegacyKeepAwake.activate();
}

export function stopLegacyRequest(): void {
  LegacyKeepAwake.deactivate();
}
```

Each instance acquires in `componentDidMount` and releases in
`componentWillUnmount`. Static calls hold a separate Class request and do not
release mounted instances or root requests. There is no Class `enabled` option;
prefer the root hook/component for new conditional code.

## Ownership model

All native public APIs share `KeepAwakeOwners.js` within a loaded package
instance in one JavaScript runtime. Every hook, component, mounted Class instance
and token owns an independent request. Root imperative functions hold one implicit
request; Class static methods hold another. Repeated implicit activation does not
increment the count. Release is idempotent and can never release another owner.

The **first owner** requests native activation; only the **last release** requests
native deactivation. Intermediate owners do not issue redundant native calls.
There is no public force-off operation. Native coordinators combine requests from
valid native module instances/runtimes; the JS coordinator itself does not span
runtimes or independently installed package copies.

Android reconciles `FLAG_KEEP_SCREEN_ON` on Activity/window lifecycle changes.
iOS reconciles `UIApplication.idleTimerDisabled` on the main queue. Native
invalidation revokes that runtime's ownership and fences stale callbacks; handles
do not transfer to a new runtime. JS cleanup does not synchronously confirm an OS
write. **There is no public asynchronous OS-state getter.** Other software writing
the same flags can interfere; absolute isolation from external writers is not
promised.

### Cleanup and errors

Native activation errors propagate without retaining an owner, so a later
acquisition can retry. If final native deactivation throws, the release and its
implicit slot are already consumed. Repeating release does not retry the failed
native operation or affect a later owner. Report failures in your task/event
handling. Hook and Class lifecycle errors follow React's effect/lifecycle error
handling. Successful JS calls express intent, not measured screen state.

## React Navigation

A blurred screen may stay mounted. If your app already uses React Navigation,
use its [focus boolean](https://reactnavigation.org/docs/use-is-focused/) to own a
request only while focused. Render this screen inside your existing navigator:

```tsx
import React from 'react';
import {Text} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {useKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

export default function FocusedScreen() {
  const isFocused = useIsFocused();
  useKeepAwake({enabled: isFocused});
  return <Text>Keep awake only while this screen is focused.</Text>;
}
```

React Navigation is optional and is not a dependency of this package. Other
navigation systems can pass their focus boolean as `enabled`.

## Migration from 1.x

2.0.0 is a major release: imperative deactivate no longer overrides other owners.
Simple matching root pairs and existing declarative ownership usually need no
rewrite. Applications using deactivate as a global off switch or mixing root
and Class families must change. See the [1.6.1 → 2.0.0 guide](MIGRATION.md) for
before/after examples and API selection.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Native module unavailable | Rebuild the native app after install; install iOS Pods; verify autolinking and that you are not using Expo Go |
| Screen remains awake after deactivate | Release tokens, disable/unmount declarative owners, and release the matching root or Class request; there is no global off switch |
| Screen stays awake after navigation | Mounting does not track focus; pass focus as `enabled` |
| Native collisions / duplicate symbols | Remove the original keep-awake package and rebuild with only one implementation |
| Android SDK policy error | Ensure the app's `rootProject.ext` defines `compileSdkVersion` and `minSdkVersion` as its RN template expects |
| AGP 9 Kotlin extension error with true/true | Restore the official RN 0.87.1 false/false settings; see compatibility notes |
| iOS helper or generated header missing | Check RN's CocoaPods setup, rerun Pods/Codegen and rebuild; do not hand-copy generated files |
| No wake lock in a browser/test environment | The non-native root entry is intentionally a no-op; it does not implement the browser Wake Lock API |

Native entrypoints are import-safe if the module is missing: acquisition that
needs native activation throws `ReactNativeKCKeepAwakeUnavailableError` with a
rebuild/autolinking message. Deactivate without an implicit request is a no-op.
The non-native root entry accepts the same options and returns an idempotent
no-op token release. Legacy Class deep imports are native entrypoints.

## Testing and compatibility evidence

On 2026-10-15, the 2.0.0 implementation commit passed
[JavaScript CI](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38769209285)
and [native compatibility CI](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38769209447).
JS CI covers types, packaging, example lint and Jest. Native CI covers fresh
archive consumers, Codegen, Android host lifecycle tests and Debug/Release builds,
and iOS simulator compilation. **Those pipelines do not run device runtime tests.**

Separate local RN 0.87.1 checks exercised mixed ownership and actual OS flags on
an Android emulator and iOS simulator. They do not qualify physical devices, store
signing, every OS version or same-process iOS scene reconnection.

Maintainer guides:

- [Example development and manual smoke checks](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/example/README.md)
- [Native matrix, reproduction and evidence limits](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md)
- [Release readiness and publication checklist](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/release-readiness.md)
- [Changelog](CHANGELOG.md)

## Security and limitations

This prevents automatic screen sleep; it does not unlock a device, hold a CPU
wake lock, guarantee background execution or override system policy. Keeping the
screen on consumes power; release requests when no longer needed.

The package ships no runtime npm dependencies. Development tooling has a known
residual [`braces` advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm);
security remediation is not a claim of a vulnerability-free repository. See the
release checklist for audit status, and audit your own resolved consumer graph.

## Credits and license

An independently maintained fork of `@sayem314/react-native-keep-awake`, maintained
by Marco Crupi, based on work by Kyle Corbitt and Sayem Chowdhury. This fork is not
affiliated with or endorsed by the original maintainers unless they state otherwise.
Original license and copyright notices are preserved. Licensed under [MIT](LICENCE).
