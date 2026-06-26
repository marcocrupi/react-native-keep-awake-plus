import React, { useEffect } from "react";

import { acquireKeepAwakeOwner, releaseKeepAwakeOwner } from "./KeepAwakeOwners";
import ReactNativeKCKeepAwake from "./NativeKCKeepAwake";

export const activateKeepAwake = () => {
  ReactNativeKCKeepAwake.activate();
};

export const deactivateKeepAwake = () => {
  ReactNativeKCKeepAwake.deactivate();
};

export const useKeepAwake = () => {
  useEffect(() => {
    let released = false;

    acquireKeepAwakeOwner();

    return () => {
      if (released) {
        return;
      }

      released = true;
      releaseKeepAwakeOwner();
    };
  }, []);
};

export default () => {
  useKeepAwake();

  return null;
};
