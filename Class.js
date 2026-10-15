import React from "react";

import { acquireKeepAwake, createKeepAwakeRequest } from "./KeepAwakeOwners";

const imperativeRequest = createKeepAwakeRequest();

export default class KeepAwake extends React.Component {
  constructor(props) {
    super(props);

    this._releaseKeepAwake = null;
  }

  static activate() {
    imperativeRequest.activate();
  }

  static deactivate() {
    imperativeRequest.deactivate();
  }

  componentDidMount() {
    if (!this._releaseKeepAwake) {
      this._releaseKeepAwake = acquireKeepAwake();
    }
  }

  componentWillUnmount() {
    const release = this._releaseKeepAwake;
    this._releaseKeepAwake = null;
    if (release) {
      release();
    }
  }

  render() {
    return null;
  }
}
