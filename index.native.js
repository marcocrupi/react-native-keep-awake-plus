import { useEffect } from "react";

import { acquireKeepAwake, createKeepAwakeRequest } from "./KeepAwakeOwners";

export { acquireKeepAwake };
const imperativeRequest = createKeepAwakeRequest();
export const activateKeepAwake = imperativeRequest.activate;
export const deactivateKeepAwake = imperativeRequest.deactivate;

export const useKeepAwake = ({ enabled = true } = {}) => {
  useEffect(() => {
    if (enabled) {
      return acquireKeepAwake();
    }
  }, [enabled]);
};

export default function KeepAwake({ enabled = true } = {}) {
  useKeepAwake({ enabled });

  return null;
}
