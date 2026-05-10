import {useEffect, useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import KeepAwake, {
  activateKeepAwake,
  deactivateKeepAwake,
  useKeepAwake,
} from '@marcocrupi/react-native-keep-awake-plus';

function App() {
  const [componentMounted, setComponentMounted] = useState(false);
  const [hookMounted, setHookMounted] = useState(false);
  const [lastAction, setLastAction] = useState('app mounted');
  const [lastError, setLastError] = useState('none');

  useEffect(() => {
    console.log('[KeepAwakeSmoke] App mounted');

    return () => {
      console.log('[KeepAwakeSmoke] App unmounted');
    };
  }, []);

  const recordAction = (action: string) => {
    console.log(`[KeepAwakeSmoke] ${action}`);
    setLastAction(action);
    setLastError('none');
  };

  const recordError = (action: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.log(`[KeepAwakeSmoke] ${action} failed`, error);
    setLastAction(`${action} failed`);
    setLastError(message);
  };

  const toggleComponent = (enabled: boolean) => {
    recordAction(enabled ? 'component mounted' : 'component unmounted');
    setComponentMounted(enabled);
  };

  const toggleHook = (enabled: boolean) => {
    recordAction(enabled ? 'hook mounted' : 'hook unmounted');
    setHookMounted(enabled);
  };

  const activate = () => {
    try {
      activateKeepAwake();
      recordAction('activateKeepAwake()');
    } catch (error) {
      recordError('activateKeepAwake()', error);
    }
  };

  const deactivate = () => {
    try {
      deactivateKeepAwake();
      recordAction('deactivateKeepAwake()');
    } catch (error) {
      recordError('deactivateKeepAwake()', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Keep Awake Smoke</Text>
        <Text style={styles.caption}>
          React Native 0.84 app using the local package.
        </Text>

        <SmokeToggle
          label="Render <KeepAwake />"
          value={componentMounted}
          onValueChange={toggleComponent}
        />
        {componentMounted ? <KeepAwakeComponentSmoke /> : null}

        <SmokeToggle
          label="Render useKeepAwake() hook owner"
          value={hookMounted}
          onValueChange={toggleHook}
        />
        {hookMounted ? <KeepAwakeHookSmoke /> : null}

        <View style={styles.actions}>
          <ActionButton label="Activate" onPress={activate} />
          <ActionButton label="Deactivate" onPress={deactivate} />
        </View>

        <View style={styles.statusBlock}>
          <Text style={styles.statusLabel}>lastAction</Text>
          <Text style={styles.statusValue}>{lastAction}</Text>
        </View>
        <View style={styles.statusBlock}>
          <Text style={styles.statusLabel}>lastError</Text>
          <Text style={styles.statusValue}>{lastError}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KeepAwakeComponentSmoke() {
  useEffect(() => {
    console.log('[KeepAwakeSmoke] <KeepAwake /> mounted');

    return () => {
      console.log('[KeepAwakeSmoke] <KeepAwake /> unmounted');
    };
  }, []);

  return <KeepAwake />;
}

function KeepAwakeHookSmoke() {
  useKeepAwake();

  useEffect(() => {
    console.log('[KeepAwakeSmoke] useKeepAwake() owner mounted');

    return () => {
      console.log('[KeepAwakeSmoke] useKeepAwake() owner unmounted');
    };
  }, []);

  return <Text style={styles.hookStatus}>useKeepAwake() owner mounted</Text>;
}

function SmokeToggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        pressed ? styles.buttonPressed : null,
      ]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '700',
  },
  caption: {
    color: '#555555',
    fontSize: 15,
  },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dddddd',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toggleLabel: {
    color: '#222222',
    flex: 1,
    fontSize: 16,
    paddingRight: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#184e77',
    borderRadius: 8,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  hookStatus: {
    color: '#1b6b36',
    fontSize: 14,
  },
  statusBlock: {
    backgroundColor: '#ffffff',
    borderColor: '#dddddd',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  statusLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#111111',
    fontSize: 15,
    marginTop: 6,
  },
});

export default App;
