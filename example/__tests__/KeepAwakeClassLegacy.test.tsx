export {};

const NATIVE_KEEP_AWAKE_MODULE =
  '@marcocrupi/react-native-keep-awake-plus/NativeKCKeepAwake';

const LEGACY_CLASS_IMPORTS = [
  '@marcocrupi/react-native-keep-awake-plus/Class',
  '@marcocrupi/react-native-keep-awake-plus/Class.js',
];

function loadLegacyClassModule(moduleName: string) {
  jest.resetModules();

  const nativeKeepAwake = {
    activate: jest.fn(),
    deactivate: jest.fn(),
  };

  jest.doMock(NATIVE_KEEP_AWAKE_MODULE, () => ({
    __esModule: true,
    default: nativeKeepAwake,
  }));

  const React = require('react');
  const ReactTestRenderer = require('react-test-renderer');
  const keepAwakeModule = require(moduleName);

  return {
    React,
    ReactTestRenderer,
    KeepAwake: keepAwakeModule.default,
    nativeKeepAwake,
  };
}

describe.each(LEGACY_CLASS_IMPORTS)('legacy Class deep import %s', moduleName => {
  test('keeps static activate and deactivate as direct native calls', () => {
    const { KeepAwake, nativeKeepAwake } = loadLegacyClassModule(moduleName);

    KeepAwake.activate();
    KeepAwake.deactivate();

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).toHaveBeenCalledTimes(1);
  });

  test('activates on mount and deactivates on unmount', async () => {
    const { React, ReactTestRenderer, KeepAwake, nativeKeepAwake } =
      loadLegacyClassModule(moduleName);
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(React.createElement(KeepAwake));
    });

    expect(renderer.toJSON()).toBeNull();
    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).toHaveBeenCalledTimes(1);
  });
});
