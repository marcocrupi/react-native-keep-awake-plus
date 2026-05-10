# React Native Keep Awake Plus

`@marcocrupi/react-native-keep-awake-plus` is a React Native library for
preventing the screen from going to sleep while your app is active.

It is an independently maintained fork by Marco Crupi, based on the original
work by Kyle Corbitt and Sayem Chowdhury.

## Project status

This fork is being modernized and tested with the included React Native 0.84.1
smoke app.

The repository does not yet publish a full compatibility matrix. No registry
or repository release state is claimed here.

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

The component and hook are owner-counted. If multiple React owners are mounted
at the same time, keep-awake remains active until the last owner is unmounted.

This behavior applies to `<KeepAwake />` and `useKeepAwake()`. The native
deactivate call is made only after the final React owner is removed.

## Imperative behavior

`activateKeepAwake()` and `deactivateKeepAwake()` are direct calls to the
native module and intentionally keep last-call-wins behavior.

The imperative functions do not participate in the owner counting used by the
component and hook.

## React Native 0.84.1 smoke app

The repository includes a smoke app in `example/` targeting React Native
0.84.1. It uses npm, depends on this package through
`@marcocrupi/react-native-keep-awake-plus: "file:.."`, and enables
`install-links=true` in `example/.npmrc`.

The `install-links=true` setting avoids installing the local `file:..`
dependency as a symlink. This matters because React Native 0.84 Codegen may not
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

Minimum supported React Native: 0.73.

Development target: React Native 0.84.

The package has been validated with a React Native 0.73.11 temporary fixture
installed from the local npm tarball. That validation covered Android old
architecture build and runtime smoke, Android New Architecture Codegen/build,
iOS pod install/build, lint, root API smoke, and the legacy `Class` deep import
smoke.

The included `example/` app targets React Native 0.84.1 and is used as the main
development smoke app.

React Native versions beyond 0.84.x are not claimed as supported until
verified.

The repository does not yet publish a full compatibility matrix for every patch
release or intermediate React Native range.

Non-native environments use a no-op fallback. This should not be presented as
full browser keep-awake support.

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
