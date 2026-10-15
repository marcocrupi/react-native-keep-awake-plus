# Migrating from 1.6.1 to 2.0.0

2.0.0 deliberately replaces imperative **last-call-wins** with shared ownership.
All public native APIs participate in one coordinator per JavaScript runtime.
The first owner requests native activation; only the last release requests native
deactivation. Native coordination between runtimes remains separate.

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

## Existing imperative calls

Simple root activate/deactivate pairs keep working. Balance root and Class calls
within the same family. Repeated activate is not a reference count:

```js
activateKeepAwake();
activateKeepAwake(); // one implicit request
deactivateKeepAwake(); // releases that request once
deactivateKeepAwake(); // no-op
```

For overlapping tasks, replace a shared implicit pair with independent handles:

```js
import {acquireKeepAwake} from '@marcocrupi/react-native-keep-awake-plus';

async function runTask() {
  const release = acquireKeepAwake();
  try {
    await doWork(); // your operation
  } finally {
    release(); // idempotent; cannot release a different task
  }
}
```

Each acquisition is independent, including when released out of order. Never
acquire during React render; acquire from effects or task/event handlers.

## Conditional hooks and components

Omitted `enabled` defaults to true. False holds no owner; false → true acquires,
true → false releases, and unmount cleans up. StrictMode replay is balanced.

```tsx
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
The RN peer range remains `>=0.73.0 <0.88.0`; it does not qualify every version.
RN 0.86.3/0.87.1 are the New Architecture CI lanes; 0.85.3 is the regression
anchor. Old Architecture is best effort. AGP 9 new DSL true/true remains
UPSTREAM BLOCKED. No React Native/dependency upgrade is required by this migration.
See [compatibility](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/native-compatibility.md)
and [release readiness](https://github.com/marcocrupi/react-native-keep-awake-plus/blob/main/docs/release-readiness.md)
for exact qualification limits and the residual development-tooling `braces` advisory.
