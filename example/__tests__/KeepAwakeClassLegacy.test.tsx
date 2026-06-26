export {};

const KEEP_AWAKE_MODULE =
  '@marcocrupi/react-native-keep-awake-plus/index.native';
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
  const rootKeepAwakeModule = require(KEEP_AWAKE_MODULE);
  const keepAwakeModule = require(moduleName);

  return {
    React,
    ReactTestRenderer,
    RootKeepAwake: rootKeepAwakeModule.default,
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

  test('keeps native active until the last legacy owner unmounts', async () => {
    const { React, ReactTestRenderer, KeepAwake, nativeKeepAwake } =
      loadLegacyClassModule(moduleName);
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(KeepAwake, { key: 'first' }),
          React.createElement(KeepAwake, { key: 'second' }),
        ),
      );
    });

    expect(renderer.toJSON()).toBeNull();
    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      renderer.update(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(KeepAwake, { key: 'second' }),
        ),
      );
    });

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).toHaveBeenCalledTimes(1);
  });

  test('shares one owner count with the root component', async () => {
    const {
      React,
      ReactTestRenderer,
      RootKeepAwake,
      KeepAwake,
      nativeKeepAwake,
    } = loadLegacyClassModule(moduleName);
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(RootKeepAwake, { key: 'root' }),
          React.createElement(KeepAwake, { key: 'legacy' }),
        ),
      );
    });

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      renderer.update(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(RootKeepAwake, { key: 'root' }),
        ),
      );
    });

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).toHaveBeenCalledTimes(1);
  });

  test('keeps legacy lifecycle cleanup idempotent', () => {
    const { KeepAwake, nativeKeepAwake } = loadLegacyClassModule(moduleName);
    const owner = new KeepAwake({});

    owner.componentDidMount();
    owner.componentDidMount();

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    owner.componentWillUnmount();
    owner.componentWillUnmount();

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).toHaveBeenCalledTimes(1);
  });
});
