import KeepAwake, {
  acquireKeepAwake,
  activateKeepAwake,
  deactivateKeepAwake,
  useKeepAwake,
  type KeepAwakeOptions,
  type KeepAwakeProps,
} from '@marcocrupi/react-native-keep-awake-plus';
import Legacy from '@marcocrupi/react-native-keep-awake-plus/Class';
import LegacyJS from '@marcocrupi/react-native-keep-awake-plus/Class.js';

// Compile-only consumer contract. Never mounted or executed.
export function PublicAPIContract({enabled}: KeepAwakeProps) {
  const options: KeepAwakeOptions = {enabled};
  useKeepAwake();
  useKeepAwake(options);
  useKeepAwake({});
  const release: () => void = acquireKeepAwake();
  release();
  activateKeepAwake();
  deactivateKeepAwake();
  Legacy.activate();
  LegacyJS.deactivate();
  // @ts-expect-error enabled must be boolean
  useKeepAwake({enabled: 'yes'});
  // @ts-expect-error enabled must be boolean
  const invalid = <KeepAwake enabled="yes" />;
  return <><KeepAwake /><KeepAwake enabled={enabled} /><Legacy /><LegacyJS />{invalid}</>;
}
