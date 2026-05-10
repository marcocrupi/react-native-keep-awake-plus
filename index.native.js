import React, { useEffect } from "react";

import ReactNativeKCKeepAwake from "./NativeKCKeepAwake";

export const activateKeepAwake = () => {
  ReactNativeKCKeepAwake.activate();
};

export const deactivateKeepAwake = () => {
  ReactNativeKCKeepAwake.deactivate();
};

let keepAwakeOwnerCount = 0;

const acquireKeepAwake = () => {
  if (keepAwakeOwnerCount === 0) {
    activateKeepAwake();
  }

  keepAwakeOwnerCount += 1;
};

const releaseKeepAwake = () => {
  if (keepAwakeOwnerCount <= 0) {
    keepAwakeOwnerCount = 0;
    return;
  }

  keepAwakeOwnerCount -= 1;

  if (keepAwakeOwnerCount === 0) {
    deactivateKeepAwake();
  }
};

export const useKeepAwake = () => {
  useEffect(() => {
    let released = false;

    acquireKeepAwake();

    return () => {
      if (released) {
        return;
      }

      released = true;
      releaseKeepAwake();
    };
  }, []);
};

export default () => {
  useKeepAwake();

  return null;
};
