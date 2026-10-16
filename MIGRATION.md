# Migrating from 1.6.1 to 2.0.0

2.0.0 deliberately replaces imperative **last-call-wins** with shared ownership.
All public native APIs participate in one coordinator per JavaScript runtime.
The first owner requests native activation; only the last release requests native
deactivation. Native coordination between runtimes remains separate.

## Who needs to change code?

Install 2.0.0 using the [installation guide](README.md#installation), then
rebuild the native app, including installing Pods on iOS.

Existing hooks/components and matching root activate/deactivate pairs usually
continue working. You do not need to rewrite every screen. Review code that:

- Uses deactivate to override mounted owners or to reset the whole app.
- Mixes root functions with Class static methods.
- Uses one implicit pair for overlapping independent operations.
- Depends on repeated deactivate calls retrying a failed native cleanup.

## Breaking changes

- `activateKeepAwake()` acquires one implicit root request; repeat calls do nothing.
- `deactivateKeepAwake()` releases only that request; it cannot switch off a hook,
  component, token, mounted Class instance or Class static request. Calling it
  before activation, or again after release, does nothing and needs no native module.
- `Class.activate()` / `Class.deactivate()` use a separate implicit Class request.
  `/Class` and `/Class.js` refer to the same family. Root deactivate cannot undo
  Class activate, and Class deactivate cannot undo root activate.
- A final release is consumed even if native deactivation throws. Repeating it
  does not retry native deactivation or affect a subsequently acquired owner.

In 1.6.1, direct imperative deactivate could override a mounted declarative owner.
In 2.0.0 that owner retains its request. Applications using deactivate as a global
off switch must release the actual task handles, disable/unmount declarative
owners, and pair each implicit activation with its own API family's deactivation.
There is no public force-off API.

## Replace a global off switch

Before (1.6.1): imperative deactivate directly requested native off, even while a
hook was mounted. This pattern intentionally stops working in 2.0.0:

```tsx
import React from 'react';
import {Button} from 'react-native';
import {deactivateKeepAwake, useKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

export default function Player() {
  useKeepAwake();
  return <Button title="Allow sleep" onPress={deactivateKeepAwake} />;
}
```

After (2.0.0): disable the owner that actually holds the request:

```tsx
import React, {useState} from 'react';
import {Button} from 'react-native';
import {useKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

export default function Player() {
  const [enabled, setEnabled] = useState(true);
  useKeepAwake({enabled});
  return <Button title="Allow sleep" onPress={() => setEnabled(false)} />;
}
```

Other owners still retain their own requests. An app-wide sleep policy must
coordinate those owners in application state; there is no replacement force-off
function.

## Existing imperative calls

Simple root activate/deactivate pairs keep working. Balance root and Class calls
within the same family. Repeated activate is not a reference count:

```js
import {activateKeepAwake, deactivateKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

activateKeepAwake();
activateKeepAwake(); // one implicit request
deactivateKeepAwake(); // releases that request once
deactivateKeepAwake(); // no-op
```

For overlapping tasks, replace a shared implicit pair with independent handles.
Before (1.6.1), one task finishing could request off while another was running:

```ts
import {activateKeepAwake, deactivateKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

export async function runTask(work: () => Promise<void>): Promise<void> {
  activateKeepAwake();
  try {
    await work();
  } finally {
    deactivateKeepAwake();
  }
}
```

After (2.0.0), each invocation releases only its own task:

```ts
import {acquireKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

export async function runTask(work: () => Promise<void>): Promise<void> {
  const release = acquireKeepAwake();
  try {
    await work();
  } finally {
    release();
  }
}
```

Even in 2.0.0 a shared root pair represents one request, so overlapping tasks
should use tokens rather than treating repeated activate as a reference count.

Each acquisition is independent, including when released out of order. Never
acquire during React render; acquire from effects or task/event handlers.

## Conditional hooks and components

Omitted `enabled` defaults to true. False holds no owner; false → true acquires,
true → false releases, and unmount cleans up. StrictMode replay is balanced.

```tsx
import React from 'react';
import KeepAwake, {useKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

function Player({playing}: {playing: boolean}) {
  useKeepAwake({enabled: playing}); // call the hook on every render
  return null;
}

function PlayerWithComponent({playing}: {playing: boolean}) {
  return <KeepAwake enabled={playing} />;
}
```

Mounted legacy Class instances still hold independent lifecycle owners. Class
static calls never release an instance. Use the root component for `enabled`.

If your application uses React Navigation, pass `useIsFocused()` as `enabled`,
or return a token release from a memoized `useFocusEffect` callback. A screen may
remain mounted after blur, so mounting alone does not track focus. Navigation
is not a package dependency; applications can supply their own focus boolean.
See the [README example](README.md#react-navigation).

## Root and Class are separate families

In 1.6.1, root and Class static methods directly controlled native state. In
2.0.0, pair each family with itself. For example, replace
`LegacyKeepAwake.activate(); deactivateKeepAwake();` with:

```js
import LegacyKeepAwake from '@marcocrupi/react-native-keep-awake-plus/Class';

LegacyKeepAwake.activate();
LegacyKeepAwake.deactivate();
```

Root deactivate cannot release the Class request, and Class deactivate cannot
release the root request. `/Class` and `/Class.js` share the same Class request.
Mounted Class instances remain independent of both static families.

## Choose an API

| Need | API |
| --- | --- |
| Mounted screen | `useKeepAwake()` or `<KeepAwake />` |
| Focus, playback or workout state | Hook/component with `enabled` |
| Independent async task | `acquireKeepAwake()` and `try/finally` |
| One centrally managed imperative switch | Root activate/deactivate pair |
| Existing Class integration | Keep its lifecycle or pair its static methods; no mandatory rewrite |

## Native errors and observed state

Synchronous activation errors propagate and retain no owner; later acquisition
retries. Final deactivation errors propagate after consuming the release. The
root/Class implicit slot and Class lifecycle handle are also cleared before
cleanup, allowing later acquisitions to work. Report errors in event/task
handlers; React effect/lifecycle errors follow React's error handling and may
unmount a tree. Do not infer successful cleanup of the OS flag from JS cleanup.

Calls express keep-awake intent. Native UI-thread work, lifecycle changes,
other runtimes and third-party flag writes can affect the observed state.
There is no public async OS-state API. This does not unlock the screen, hold a
CPU wake lock or authorize background execution. Handles do not transfer across
runtime invalidation/reload.

The non-native root entry remains a no-op with identical optional arguments and
an idempotent release; it provides no browser wake lock. Class deep imports are
native entrypoints. Native APIs remain import-safe; acquisitions that need a
missing module throw an explicit rebuild/autolinking error.

## Installation and compatibility

Install 2.0.0 after publication, run `pod install` on iOS and rebuild your app.
Never install this fork alongside the original package: native identifiers collide.
From 2.0.1 the RN peer range is `>=0.73.0` with no upper bound (React
`>=18.2.0`). Every stable RN release with the New Architecture, from 0.76, is
supported. RN 0.88.0/0.87.1 are the PR CI lanes, 0.82.1/0.78.3/0.76.9 the weekly
window lanes and 0.85.3 the regression anchor. Old Architecture is best effort. AGP 9 new DSL true/true remains
UPSTREAM BLOCKED. The JS ownership change itself requires no RN upgrade, but
older consumers must check the modernized Gradle/CocoaPods requirements before
upgrading the package.
See [compatibility](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md)
and [release readiness](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/release-readiness.md)
for exact qualification limits and the residual development-tooling `braces` advisory.
