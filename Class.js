import React from "react";

import { acquireKeepAwakeOwner, releaseKeepAwakeOwner } from "./KeepAwakeOwners";
import {
  activateKeepAwakeNative,
  deactivateKeepAwakeNative,
} from "./NativeKCKeepAwakeModule";

export default class KeepAwake extends React.Component {
  constructor(props) {
    super(props);

    this._keepAwakeOwnerAcquired = false;
  }

  static activate() {
    activateKeepAwakeNative();
  }

  static deactivate() {
    deactivateKeepAwakeNative();
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
