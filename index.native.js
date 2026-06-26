import React, { useEffect } from "react";

import { acquireKeepAwakeOwner, releaseKeepAwakeOwner } from "./KeepAwakeOwners";
import {
  activateKeepAwakeNative,
  deactivateKeepAwakeNative,
} from "./NativeKCKeepAwakeModule";

export const activateKeepAwake = () => {
  activateKeepAwakeNative();
};

export const deactivateKeepAwake = () => {
  deactivateKeepAwakeNative();
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
