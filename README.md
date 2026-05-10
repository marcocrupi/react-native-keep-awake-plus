# React Native Keep Awake Plus

This React Native package allows you to prevent the screen from going to sleep
while your app is active. It's useful for things like navigation or video
playback, where the user expects the app to remain visible over long periods
without touch interaction.

## About this fork

`@marcocrupi/react-native-keep-awake-plus` is an independently maintained
fork of `@sayem314/react-native-keep-awake`.

The original project was created by Kyle Corbitt and later maintained by Sayem
Chowdhury.

This fork is maintained by Marco Crupi.

The goal of this fork is to keep the package usable and maintained for modern
React Native projects while preserving the original public API where possible.

The original MIT license and copyright notices are preserved.

The original maintainers have not stated any affiliation with this fork.

## Installation

As the first step, install this module:

### React Native 0.60+

`yarn add @marcocrupi/react-native-keep-awake-plus`

### React Native new architecture

Validate New Architecture support against the version of
`@marcocrupi/react-native-keep-awake-plus` you install and your target React
Native version.

## Usage

### Example: hooks

```js
import { useKeepAwake } from '@marcocrupi/react-native-keep-awake-plus';
import React from 'react';
import { Text, View } from 'react-native';

export default function KeepAwakeExample {
  useKeepAwake();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>This screen will never sleep!</Text>
    </View>
  );
}
```

### Example: components

```js
import KeepAwake from '@marcocrupi/react-native-keep-awake-plus';
import React from 'react';
import { Text, View } from 'react-native';

export default function KeepAwakeExample {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <KeepAwake />
      <Text>This screen will never sleep!</Text>
    </View>
  );
}
```

### Example: functions

```js
import { activateKeepAwake, deactivateKeepAwake} from "@marcocrupi/react-native-keep-awake-plus";
import React from "react";
import { Button, View } from "react-native";

export default class KeepAwakeExample extends React.Component {
  render() {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Button onPress={this._activate}>Activate</Button>
        <Button onPress={this._deactivate}>Deactivate</Button>
      </View>
    );
  }

  _activate = () => {
    activateKeepAwake();
  };

  _deactivate = () => {
    deactivateKeepAwake();
  };
}
```
