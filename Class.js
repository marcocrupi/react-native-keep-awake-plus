import React from "react";

import { acquireKeepAwakeOwner, releaseKeepAwakeOwner } from "./KeepAwakeOwners";
import ReactNativeKCKeepAwake from "./NativeKCKeepAwake";

export default class KeepAwake extends React.Component {
  constructor(props) {
    super(props);

    this._keepAwakeOwnerAcquired = false;
  }

  static activate() {
    ReactNativeKCKeepAwake.activate();
  }

  static deactivate() {
    ReactNativeKCKeepAwake.deactivate();
  }

  componentDidMount() {
    if (this._keepAwakeOwnerAcquired) {
      return;
    }

    acquireKeepAwakeOwner();
    this._keepAwakeOwnerAcquired = true;
  }

  componentWillUnmount() {
    if (!this._keepAwakeOwnerAcquired) {
      return;
    }

    this._keepAwakeOwnerAcquired = false;
    releaseKeepAwakeOwner();
  }

  render() {
    return null;
  }
}
