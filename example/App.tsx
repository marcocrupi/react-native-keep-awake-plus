import { useEffect, useState } from 'react';
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
  const [componentOwnerAMounted, setComponentOwnerAMounted] = useState(false);
  const [componentOwnerBMounted, setComponentOwnerBMounted] = useState(false);
  const [hookOwnerAMounted, setHookOwnerAMounted] = useState(false);
  const [hookOwnerBMounted, setHookOwnerBMounted] = useState(false);
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

  const toggleComponentOwnerA = (enabled: boolean) => {
    recordAction(
      `toggle Component owner A ${enabled ? 'mounted' : 'unmounted'}`,
    );
    setComponentOwnerAMounted(enabled);
  };

  const toggleComponentOwnerB = (enabled: boolean) => {
    recordAction(
      `toggle Component owner B ${enabled ? 'mounted' : 'unmounted'}`,
    );
    setComponentOwnerBMounted(enabled);
  };

  const toggleHookOwnerA = (enabled: boolean) => {
    recordAction(`toggle Hook owner A ${enabled ? 'mounted' : 'unmounted'}`);
    setHookOwnerAMounted(enabled);
  };

  const toggleHookOwnerB = (enabled: boolean) => {
    recordAction(`toggle Hook owner B ${enabled ? 'mounted' : 'unmounted'}`);
    setHookOwnerBMounted(enabled);
  };

  const activate = () => {
    try {
      console.log('[KeepAwakeSmoke] Activate imperative pressed');
      activateKeepAwake();
      recordAction('Activate imperative');
    } catch (error) {
      recordError('Activate imperative', error);
    }
  };

  const deactivate = () => {
    try {
      console.log('[KeepAwakeSmoke] Deactivate imperative pressed');
      deactivateKeepAwake();
      recordAction('Deactivate imperative');
    } catch (error) {
      recordError('Deactivate imperative', error);
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
          label="Component owner A"
          value={componentOwnerAMounted}
          onValueChange={toggleComponentOwnerA}
        />
        {componentOwnerAMounted ? (
          <KeepAwakeComponentSmoke ownerName="Component owner A" />
        ) : null}

        <SmokeToggle
          label="Component owner B"
          value={componentOwnerBMounted}
          onValueChange={toggleComponentOwnerB}
        />
        {componentOwnerBMounted ? (
          <KeepAwakeComponentSmoke ownerName="Component owner B" />
        ) : null}

        <SmokeToggle
          label="Hook owner A"
          value={hookOwnerAMounted}
          onValueChange={toggleHookOwnerA}
        />
        {hookOwnerAMounted ? (
          <KeepAwakeHookSmoke ownerName="Hook owner A" />
        ) : null}

        <SmokeToggle
          label="Hook owner B"
          value={hookOwnerBMounted}
          onValueChange={toggleHookOwnerB}
        />
        {hookOwnerBMounted ? (
          <KeepAwakeHookSmoke ownerName="Hook owner B" />
        ) : null}

        <View style={styles.actions}>
          <ActionButton label="Activate imperative" onPress={activate} />
          <ActionButton label="Deactivate imperative" onPress={deactivate} />
        </View>

        <View style={styles.statusBlock}>
          <Text style={styles.statusLabel}>owner state</Text>
          <StatusLine
            label="Component owner A"
            mounted={componentOwnerAMounted}
          />
          <StatusLine
            label="Component owner B"
            mounted={componentOwnerBMounted}
          />
          <StatusLine label="Hook owner A" mounted={hookOwnerAMounted} />
          <StatusLine label="Hook owner B" mounted={hookOwnerBMounted} />
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

function KeepAwakeComponentSmoke({ ownerName }: { ownerName: string }) {
  useEffect(() => {
    console.log(`[KeepAwakeSmoke] ${ownerName} mounted`);

    return () => {
      console.log(`[KeepAwakeSmoke] ${ownerName} unmounted`);
    };
  }, [ownerName]);

  return <KeepAwake />;
}

function KeepAwakeHookSmoke({ ownerName }: { ownerName: string }) {
  useKeepAwake();

  useEffect(() => {
    console.log(`[KeepAwakeSmoke] ${ownerName} mounted`);

    return () => {
      console.log(`[KeepAwakeSmoke] ${ownerName} unmounted`);
    };
  }, [ownerName]);

  return <Text style={styles.hookStatus}>{ownerName} hook mounted</Text>;
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

function StatusLine({ label, mounted }: { label: string; mounted: boolean }) {
  return (
    <View style={styles.statusLine}>
      <Text style={styles.statusName}>{label}</Text>
      <Text style={styles.statusValue}>
        {mounted ? 'mounted' : 'unmounted'}
      </Text>
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
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.buttonPressed : null,
      ]}
    >
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
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statusLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusName: {
    color: '#333333',
    flex: 1,
    fontSize: 14,
  },
  statusValue: {
    color: '#111111',
    fontSize: 15,
    marginTop: 6,
  },
});

export default App;
