import {
  activateKeepAwakeNative,
  deactivateKeepAwakeNative,
} from "./NativeKCKeepAwakeModule";

let keepAwakeOwnerCount = 0;

// One coordinator per JS runtime. The native module coordinates runtimes.
export const acquireKeepAwake = () => {
  if (keepAwakeOwnerCount === 0) {
    activateKeepAwakeNative();
  }

  keepAwakeOwnerCount += 1;
  let released = false;

  return () => {
    if (released) {
      return;
    }

    // Consume before native: a throwing release cannot affect a later owner.
    released = true;
    keepAwakeOwnerCount -= 1;
    if (keepAwakeOwnerCount === 0) {
      deactivateKeepAwakeNative();
    }
  };
};

// Each API family holds its own implicit request, backed by the same tokens.
export const createKeepAwakeRequest = () => {
  let release = null;

  return {
    activate() {
      if (!release) {
        release = acquireKeepAwake();
      }
    },
    deactivate() {
      const done = release;
      release = null;
      if (done) {
        done();
      }
    },
  };
};
