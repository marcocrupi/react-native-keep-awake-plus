export {};

const KEEP_AWAKE_MODULE = '../../index.native';
const NATIVE_KEEP_AWAKE_MODULE = '../../NativeKCKeepAwake';

const LEGACY_CLASS_IMPORTS = ['../../Class', '../../Class.js'];

function mockMissingNativeModule() {
  jest.doMock(NATIVE_KEEP_AWAKE_MODULE, () => {
    throw new Error('Native module missing: ReactNativeKCKeepAwake');
  });
}

function expectNativeModuleMissingError(fn: () => void) {
  let thrownError: unknown;

  try {
    fn();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(Error);

  const message = (thrownError as Error).message;

  expect(message).toContain('ReactNativeKCKeepAwake');
  expect(message).toContain('@marcocrupi/react-native-keep-awake-plus');
  expect(message).toContain('rebuilt');
  expect(message).toContain('autolinking');
}

describe('KeepAwake native module missing behavior', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock(NATIVE_KEEP_AWAKE_MODULE);
    jest.resetModules();
  });

  test('keeps the root native entry import-safe and throws explicit errors on imperative use', () => {
    mockMissingNativeModule();

    let keepAwakeModule: typeof import('../../index');

    expect(() => {
      keepAwakeModule = require(KEEP_AWAKE_MODULE);
    }).not.toThrow();

    expectNativeModuleMissingError(() => keepAwakeModule.activateKeepAwake());
    expectNativeModuleMissingError(() => keepAwakeModule.deactivateKeepAwake());
  });

  describe.each(LEGACY_CLASS_IMPORTS)('legacy Class import %s', moduleName => {
    test('is import-safe and throws explicit errors on static use', () => {
      mockMissingNativeModule();

      let keepAwakeModule: {
        default: {
          activate: () => void;
          deactivate: () => void;
        };
      };

      expect(() => {
        keepAwakeModule = require(moduleName);
      }).not.toThrow();

      expectNativeModuleMissingError(() => keepAwakeModule.default.activate());
      expectNativeModuleMissingError(() => keepAwakeModule.default.deactivate());
    });
  });

  test('throws explicit errors on legacy lifecycle use when the native module is missing', () => {
    mockMissingNativeModule();

    const KeepAwake = require('../../Class').default;
    const owner = new KeepAwake({});

    expectNativeModuleMissingError(() => owner.componentDidMount());
    expect(owner._keepAwakeOwnerAcquired).toBe(false);
    expect(() => owner.componentWillUnmount()).not.toThrow();
  });

  test('does not retain an owner after the first native activate throws', () => {
    const nativeKeepAwake = {
      activate: jest.fn(() => {
        throw new Error('Native activate failed');
      }),
      deactivate: jest.fn(),
    };

    jest.doMock(NATIVE_KEEP_AWAKE_MODULE, () => ({
      __esModule: true,
      default: nativeKeepAwake,
    }));

    const KeepAwake = require('../../Class').default;
    const failedOwner = new KeepAwake({});

    expect(() => failedOwner.componentDidMount()).toThrow(
      'Native activate failed',
    );
    expect(failedOwner._keepAwakeOwnerAcquired).toBe(false);

    nativeKeepAwake.activate.mockImplementation(() => {});

    const nextOwner = new KeepAwake({});

    expect(() => nextOwner.componentDidMount()).not.toThrow();
    expect(nativeKeepAwake.activate).toHaveBeenCalledTimes(2);
    expect(nativeKeepAwake.deactivate).not.toHaveBeenCalled();

    nextOwner.componentWillUnmount();

    expect(nativeKeepAwake.deactivate).toHaveBeenCalledTimes(1);
  });
});
