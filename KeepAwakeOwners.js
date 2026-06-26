import ReactNativeKCKeepAwake from "./NativeKCKeepAwake";

let keepAwakeOwnerCount = 0;

export const acquireKeepAwakeOwner = () => {
  if (keepAwakeOwnerCount === 0) {
    ReactNativeKCKeepAwake.activate();
  }

  keepAwakeOwnerCount += 1;
};

export const releaseKeepAwakeOwner = () => {
  if (keepAwakeOwnerCount <= 0) {
    keepAwakeOwnerCount = 0;
    return;
  }

  keepAwakeOwnerCount -= 1;

  if (keepAwakeOwnerCount === 0) {
    ReactNativeKCKeepAwake.deactivate();
  }
};
