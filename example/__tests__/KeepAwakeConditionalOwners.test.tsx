export {};

function load() {
  jest.resetModules();
  const native = {activate: jest.fn(), deactivate: jest.fn()};
  jest.doMock('../../NativeKCKeepAwake', () => ({
    __esModule: true,
    default: native,
  }));
  const React = require('react');
  jest.doMock('react', () => React);
  const rootReact = (require as typeof require & {resolve(id: string): string}).resolve('../../node_modules/react');
  jest.doMock(rootReact, () => React);
  return {
    React,
    renderer: require('react-test-renderer'),
    api: require('../../index.native'),
    Legacy: require('../../Class').default,
    native,
  };
}

describe('conditional and imperative owners', () => {
  test.each(['component', 'hook'])('%s tracks enabled, not options identity', async kind => {
    const {React, renderer, api, native} = load();
    function Hook({enabled}: {enabled?: boolean}) {
      api.useKeepAwake({enabled});
      return null;
    }
    const Owner = kind === 'component' ? api.default : Hook;
    let tree: ReturnType<typeof renderer.create>;
    const update = async (enabled?: boolean) => {
      await renderer.act(async () => {
        tree.update(React.createElement(Owner, {enabled}));
      });
    };
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(Owner, {enabled: false}));
    });
    expect(native.activate).not.toHaveBeenCalled();
    expect(native.deactivate).not.toHaveBeenCalled();
    await update(true);
    await update(true);
    expect(native.activate).toHaveBeenCalledTimes(1);
    await update(false);
    await update(false);
    expect(native.deactivate).toHaveBeenCalledTimes(1);
    await update(); // omitted enabled defaults to true
    expect(native.activate).toHaveBeenCalledTimes(2);
    await renderer.act(async () => tree.unmount());
    expect(native.deactivate).toHaveBeenCalledTimes(2);
  });

  test('independent releases are idempotent and cannot release another owner', () => {
    const {api, native} = load();
    const first = api.acquireKeepAwake();
    const second = api.acquireKeepAwake();
    expect(native.activate).toHaveBeenCalledTimes(1);
    first();
    first();
    expect(native.deactivate).not.toHaveBeenCalled();
    second();
    second();
    expect(native.deactivate).toHaveBeenCalledTimes(1);
    const third = api.acquireKeepAwake();
    first();
    second();
    expect(native.deactivate).toHaveBeenCalledTimes(1);
    third();
    expect(native.activate).toHaveBeenCalledTimes(2);
    expect(native.deactivate).toHaveBeenCalledTimes(2);
  });

  test('tokens share ownership with conditional hook, component and legacy Class', async () => {
    const {React, renderer, api, Legacy, native} = load();
    function Hook({enabled}: {enabled: boolean}) {
      api.useKeepAwake({enabled});
      return null;
    }
    const release = api.acquireKeepAwake();
    let tree: ReturnType<typeof renderer.create>;
    const children = (enabled: boolean) => React.createElement(
      React.Fragment, null,
      React.createElement(api.default, {key: 'component', enabled}),
      React.createElement(Hook, {key: 'hook', enabled}),
      React.createElement(Legacy, {key: 'legacy'}),
    );
    await renderer.act(async () => { tree = renderer.create(children(true)); });
    release();
    await renderer.act(async () => { tree.update(children(false)); });
    expect(native.activate).toHaveBeenCalledTimes(1);
    expect(native.deactivate).not.toHaveBeenCalled();
    await renderer.act(async () => tree.unmount());
    expect(native.deactivate).toHaveBeenCalledTimes(1);
  });

  test('StrictMode really replays enabled effects and settles after disabled/unmount', async () => {
    const {React, renderer, api, native} = load();
    let tree: ReturnType<typeof renderer.create>;
    const child = (enabled: boolean) => React.createElement(
      React.StrictMode, null, React.createElement(api.default, {enabled}),
    );
    await renderer.act(async () => { tree = renderer.create(child(true)); });
    // Assert the renderer exercised setup -> cleanup -> setup, not just a mount.
    expect(native.activate).toHaveBeenCalledTimes(2);
    expect(native.deactivate).toHaveBeenCalledTimes(1);
    await renderer.act(async () => { tree.update(child(false)); });
    expect(native.deactivate).toHaveBeenCalledTimes(2);
    await renderer.act(async () => tree.unmount());
    expect(native.deactivate).toHaveBeenCalledTimes(2);
    const release = api.acquireKeepAwake();
    expect(native.activate).toHaveBeenCalledTimes(3);
    release();
    expect(native.deactivate).toHaveBeenCalledTimes(3);
  });

  test('failed activation retains no owner and next acquisition retries native', () => {
    const {api, native} = load();
    native.activate.mockImplementationOnce(() => { throw new Error('activate failed'); });
    expect(() => api.acquireKeepAwake()).toThrow('activate failed');
    const release = api.acquireKeepAwake();
    expect(native.activate).toHaveBeenCalledTimes(2);
    release();
    expect(native.deactivate).toHaveBeenCalledTimes(1);
  });

  test('throwing final deactivation consumes its release and leaves later owners independent', () => {
    const {api, native} = load();
    const release = api.acquireKeepAwake();
    native.deactivate.mockImplementationOnce(() => { throw new Error('deactivate failed'); });
    expect(release).toThrow('deactivate failed');
    const next = api.acquireKeepAwake();
    expect(release).not.toThrow();
    expect(native.deactivate).toHaveBeenCalledTimes(1);
    expect(native.activate).toHaveBeenCalledTimes(2);
    next();
    expect(native.deactivate).toHaveBeenCalledTimes(2);
  });

  test.each(['activate', 'deactivate'] as const)('React effect %s failure leaves no leaked owner', async operation => {
    const {React, renderer, api, native} = load();
    let tree: ReturnType<typeof renderer.create>;
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(api.default, {enabled: false}));
    });
    if (operation === 'deactivate') {
      await renderer.act(async () => {
        tree.update(React.createElement(api.default, {enabled: true}));
      });
    }
    native[operation].mockImplementationOnce(() => { throw new Error('effect failed'); });
    let caught: unknown;
    try {
      await renderer.act(async () => {
        tree.update(React.createElement(api.default, {enabled: operation === 'activate'}));
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toEqual(new Error('effect failed'));
    const release = api.acquireKeepAwake();
    expect(native.activate).toHaveBeenCalledTimes(2);
    release();
    expect(native.deactivate).toHaveBeenCalledTimes(operation === 'activate' ? 1 : 2);
    await renderer.act(async () => tree.unmount());
    expect(native.deactivate).toHaveBeenCalledTimes(operation === 'activate' ? 1 : 2);
  });

  test('root and Class implicit requests are distinct and preserve independent tokens', () => {
    const {api, native, Legacy} = load();
    api.deactivateKeepAwake();
    Legacy.deactivate();
    expect(native.deactivate).not.toHaveBeenCalled();
    const release = api.acquireKeepAwake();
    api.activateKeepAwake();
    api.activateKeepAwake();
    Legacy.activate();
    Legacy.activate();
    api.deactivateKeepAwake();
    api.deactivateKeepAwake();
    release();
    release();
    expect(native.activate).toHaveBeenCalledTimes(1);
    expect(native.deactivate).not.toHaveBeenCalled();
    Legacy.deactivate();
    Legacy.deactivate();
    expect(native.deactivate).toHaveBeenCalledTimes(1);
    // Neither API family can release the other's implicit request.
    api.activateKeepAwake();
    Legacy.deactivate();
    expect(native.activate).toHaveBeenCalledTimes(2);
    expect(native.deactivate).toHaveBeenCalledTimes(1);
    api.deactivateKeepAwake();
    expect(native.deactivate).toHaveBeenCalledTimes(2);
  });

  test.each(['root', 'Class'] as const)('%s imperative release preserves hook and component until their cleanup', async family => {
    const {React, renderer, api, Legacy, native} = load();
    const activate = family === 'root' ? api.activateKeepAwake : Legacy.activate;
    const deactivate = family === 'root' ? api.deactivateKeepAwake : Legacy.deactivate;
    function Hook() {
      api.useKeepAwake();
      return null;
    }
    let tree: ReturnType<typeof renderer.create>;
    activate();
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(React.Fragment, null,
        React.createElement(Hook), React.createElement(api.default),
      ));
    });
    deactivate();
    deactivate();
    expect(native.activate).toHaveBeenCalledTimes(1);
    expect(native.deactivate).not.toHaveBeenCalled();
    await renderer.act(async () => tree.unmount());
    expect(native.deactivate).toHaveBeenCalledTimes(1);
  });

  test.each(['root', 'Class'] as const)('%s implicit request survives other owner releases and recovers after native failures', family => {
    const {api, Legacy, native} = load();
    const activate = family === 'root' ? api.activateKeepAwake : Legacy.activate;
    const deactivate = family === 'root' ? api.deactivateKeepAwake : Legacy.deactivate;
    const events: string[] = [];
    native.activate.mockImplementation(() => events.push('on'));
    native.deactivate.mockImplementation(() => events.push('off'));
    native.activate.mockImplementationOnce(() => { throw new Error('on failed'); });
    expect(activate).toThrow('on failed');
    deactivate(); // failed acquisition created no implicit owner
    expect(events).toEqual([]);
    activate();
    activate();
    const release = api.acquireKeepAwake();
    release();
    expect(events).toEqual(['on']);
    native.deactivate.mockImplementationOnce(() => { throw new Error('off failed'); });
    expect(deactivate).toThrow('off failed');
    const next = api.acquireKeepAwake();
    expect(deactivate).not.toThrow(); // failed release was consumed
    expect(events).toEqual(['on', 'on']);
    next();
    activate();
    deactivate();
    expect(events).toEqual(['on', 'on', 'off', 'on', 'off']);
  });

  test('legacy lifecycle in StrictMode and throwing cleanup cannot release later owners', async () => {
    const {React, renderer, api, Legacy, native} = load();
    let tree: ReturnType<typeof renderer.create>;
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(React.StrictMode, null, React.createElement(Legacy)));
    });
    expect(native.activate).toHaveBeenCalledTimes(2);
    expect(native.deactivate).toHaveBeenCalledTimes(1);
    await renderer.act(async () => tree.unmount());
    expect(native.deactivate).toHaveBeenCalledTimes(2);
    const instance = new Legacy({});
    instance.componentDidMount();
    native.deactivate.mockImplementationOnce(() => { throw new Error('cleanup failed'); });
    expect(() => instance.componentWillUnmount()).toThrow('cleanup failed');
    const release = api.acquireKeepAwake();
    instance.componentWillUnmount();
    expect(native.deactivate).toHaveBeenCalledTimes(3);
    release();
    expect(native.deactivate).toHaveBeenCalledTimes(4);
  });

  test('disabled component needs no native module, enabled acquisition reports missing module', async () => {
    const {React, renderer, api} = load();
    jest.doMock('../../NativeKCKeepAwake', () => { throw new Error('missing'); });
    let tree: ReturnType<typeof renderer.create>;
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(api.default, {enabled: false}));
    });
    await renderer.act(async () => tree.unmount());
    expect(() => api.acquireKeepAwake()).toThrow('autolinking');
  });

  test('non-native fallback exposes the same optional API without native access', () => {
    const {React, renderer, native} = load();
    const fallback = require('../../index.js');
    fallback.activateKeepAwake();
    fallback.activateKeepAwake();
    fallback.deactivateKeepAwake();
    fallback.deactivateKeepAwake();
    const release = fallback.acquireKeepAwake();
    expect(typeof release).toBe('function');
    expect(release()).toBeUndefined();
    expect(release()).toBeUndefined();
    function Hook() {
      fallback.useKeepAwake({enabled: false});
      return React.createElement(fallback.default, {enabled: true});
    }
    let tree: ReturnType<typeof renderer.create>;
    renderer.act(() => { tree = renderer.create(React.createElement(Hook)); });
    expect(tree!.toJSON()).toBeNull();
    renderer.act(() => tree.unmount());
    expect(native.activate).not.toHaveBeenCalled();
    expect(native.deactivate).not.toHaveBeenCalled();
  });
});
