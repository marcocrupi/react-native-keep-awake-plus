import React from "react";

import ReactNativeKCKeepAwake from "./NativeKCKeepAwake";

export default class KeepAwake extends React.Component {
  static activate() {
    ReactNativeKCKeepAwake.activate();
  }

  static deactivate() {
    ReactNativeKCKeepAwake.deactivate();
  }

  componentDidMount() {
    KeepAwake.activate();
  }

  componentWillUnmount() {
    KeepAwake.deactivate();
  }

  render() {
    return null;
  }
}
