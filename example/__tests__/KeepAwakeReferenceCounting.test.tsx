const KEEP_AWAKE_MODULE =
  '@marcocrupi/react-native-keep-awake-plus/index.native';
const NATIVE_KEEP_AWAKE_MODULE =
  '@marcocrupi/react-native-keep-awake-plus/NativeKCKeepAwake';

function loadKeepAwakeModule() {
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
  const keepAwakeModule = require(KEEP_AWAKE_MODULE);

  return {
    React,
    ReactTestRenderer,
    KeepAwake: keepAwakeModule.default,
    useKeepAwake: keepAwakeModule.useKeepAwake,
    activateKeepAwake: keepAwakeModule.activateKeepAwake,
    deactivateKeepAwake: keepAwakeModule.deactivateKeepAwake,
    nativeKeepAwake,
  };
}

describe('KeepAwake reference counting', () => {
  test('activates on mount and deactivates on unmount for one component owner', async () => {
    const { React, ReactTestRenderer, KeepAwake, nativeKeepAwake } =
      loadKeepAwakeModule();
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(React.createElement(KeepAwake));
    });

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).toHaveBeenCalledTimes(1);
  });

  test('keeps native active until the last component owner unmounts', async () => {
    const { React, ReactTestRenderer, KeepAwake, nativeKeepAwake } =
      loadKeepAwakeModule();
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

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(1);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      renderer.update(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(KeepAwake, { key: 'first' }),
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

  test('keeps native active until the last hook owner unmounts', async () => {
    const { React, ReactTestRenderer, useKeepAwake, nativeKeepAwake } =
      loadKeepAwakeModule();
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    function HookOwner() {
      useKeepAwake();

      return null;
    }

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(HookOwner, { key: 'first' }),
          React.createElement(HookOwner, { key: 'second' }),
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
          React.createElement(HookOwner, { key: 'first' }),
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

  test('shares one native activation across component and hook owners', async () => {
    const {
      React,
      ReactTestRenderer,
      KeepAwake,
      useKeepAwake,
      nativeKeepAwake,
    } = loadKeepAwakeModule();
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    function HookOwner() {
      useKeepAwake();

      return null;
    }

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(KeepAwake, { key: 'component' }),
          React.createElement(HookOwner, { key: 'hook' }),
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
          React.createElement(KeepAwake, { key: 'component' }),
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

  test('keeps imperative functions as direct native pass-through calls', () => {
    const {
      activateKeepAwake,
      deactivateKeepAwake,
      nativeKeepAwake,
    } = loadKeepAwakeModule();

    activateKeepAwake();
    activateKeepAwake();

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(2);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    deactivateKeepAwake();
    deactivateKeepAwake();

    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(2);
    expect(nativeKeepAwake.deactivate).toHaveBeenCalledTimes(2);
  });
});
