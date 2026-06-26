const NATIVE_MODULE_UNAVAILABLE_MESSAGE =
  "ReactNativeKCKeepAwake native module is not available. Make sure the app has been rebuilt after installing @marcocrupi/react-native-keep-awake-plus and that native autolinking is configured correctly.";

let nativeKeepAwake = null;

const createNativeModuleUnavailableError = () => {
  const error = new Error(NATIVE_MODULE_UNAVAILABLE_MESSAGE);
  error.name = "ReactNativeKCKeepAwakeUnavailableError";
  return error;
};

export const getNativeKeepAwakeModule = () => {
  if (nativeKeepAwake) {
    return nativeKeepAwake;
  }

  let nativeModuleExport;

  try {
    nativeModuleExport = require("./NativeKCKeepAwake");
  } catch (error) {
    throw createNativeModuleUnavailableError();
  }

  const resolvedNativeModule =
    nativeModuleExport && nativeModuleExport.default
      ? nativeModuleExport.default
      : nativeModuleExport;

  if (
    !resolvedNativeModule ||
    typeof resolvedNativeModule.activate !== "function" ||
    typeof resolvedNativeModule.deactivate !== "function"
  ) {
    throw createNativeModuleUnavailableError();
  }

  nativeKeepAwake = resolvedNativeModule;

  return nativeKeepAwake;
};

export const activateKeepAwakeNative = () => {
  getNativeKeepAwakeModule().activate();
};

export const deactivateKeepAwakeNative = () => {
  getNativeKeepAwakeModule().deactivate();
};
