import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '../components/ui';
import { colors } from '../theme';
import { useAuthStore } from '../store/authStore';

/**
 * Biometric gate — shown at launch (and after backgrounding, when enabled)
 * before any credentials or trading data become visible.
 */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const appState = useRef(AppState.currentState);

  const authenticate = useCallback(async () => {
    setBusy(true);
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!biometricEnabled || !has || !enrolled) {
        onUnlock();
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock AI Trading Bot',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (res.success) onUnlock();
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [biometricEnabled, onUnlock]);

  useEffect(() => {
    void authenticate();
    const sub = AppState.addEventListener('change', (state) => {
      if (appState.current.match(/active/) && state === 'background') {
        // Re-lock quickly when backgrounded (2s grace for accidental switches).
        setTimeout(() => {
          if (AppState.currentState !== 'active') useAuthStore.getState().setLocked(true);
        }, 2000);
      }
      appState.current = state;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll={false}>
      <View style={styles.wrap}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>AI Trading Bot locked</Text>
        <Text style={styles.sub}>Authenticate with your fingerprint or face to continue.</Text>
        {failed ? <Text style={styles.failed}>Authentication failed — try again.</Text> : null}
        <Button label={busy ? 'Waiting for sensor…' : 'Unlock'} onPress={authenticate} loading={busy} style={styles.btn} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 54, marginBottom: 14 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  failed: { color: colors.red, fontSize: 12.5, marginTop: 12 },
  btn: { alignSelf: 'stretch', marginTop: 26 },
});
