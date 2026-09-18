import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import './src/polyfills';
import { runtime } from './src/engine/runtime';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/theme';
import { TabNavigator } from './src/navigation/TabNavigator';
import { SetupScreen } from './src/screens/SetupScreen';
import { LockScreen } from './src/screens/LockScreen';
import { registerBackgroundTick } from './src/services/backgroundTick';

/**
 * AI Trading Bot — root component.
 *
 * Boot order: runtime hydration (vault + stores) → biometric lock (optional)
 * → setup screen (no credentials) → main tab navigator.
 */
export default function App() {
  const [booted, setBooted] = useState(false);
  const [locked, setLocked] = useState(false);
  const hydrated = useAuthStore((s) => s.hydrated);
  const credentials = useAuthStore((s) => s.credentials);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const storeLocked = useAuthStore((s) => s.locked);
  const demoMode = useAuthStore((s) => s.demoMode);

  useEffect(() => {
    void runtime.init().then(() => {
      setBooted(true);
      void registerBackgroundTick(); // keep trading while the app is backgrounded (Android)
    });
  }, []);

  useEffect(() => {
    if (booted && credentials && biometricEnabled) {
      useAuthStore.getState().setLocked(true);
      setLocked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  if (!booted || !hydrated) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootLogo}>🤖</Text>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.bootText}>AI Trading Bot</Text>
      </View>
    );
  }

  if (locked || storeLocked) {
    return (
      <>
        <StatusBar style="light" />
        <LockScreen
          onUnlock={() => {
            useAuthStore.getState().setLocked(false);
            setLocked(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={colors.bg} />
      {credentials || demoMode ? <TabNavigator /> : <SetupScreen />}
    </>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bootLogo: { fontSize: 52 },
  bootText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
});
