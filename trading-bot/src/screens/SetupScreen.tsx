import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ConfirmModal, Field, Screen, Segmented, StatusDot } from '../components/ui';
import { colors } from '../theme';
import { ENVIRONMENTS, type Environment } from '../config';
import { runtime } from '../engine/runtime';
import { useAuthStore } from '../store/authStore';

const HEX_RE = /^[0-9a-fA-F]{64}$/;

export function SetupScreen() {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [env, setEnv] = useState<Environment>('testnet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveWarn, setLiveWarn] = useState(false);
  const restStatus = useAuthStore((s) => s.restStatus);

  const pickEnv = (e: Environment) => {
    if (e === 'live') setLiveWarn(true);
    else setEnv(e);
  };

  const connect = async () => {
    setError(null);
    if (!HEX_RE.test(apiKey.trim())) {
      setError('API key must be a 64-character hexadecimal string.');
      return;
    }
    if (apiSecret.trim().length < 32) {
      setError('API secret looks too short — copy it exactly from Binance.');
      return;
    }
    setBusy(true);
    const res = await runtime.testAndSaveCredentials(apiKey.trim(), apiSecret.trim(), env);
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Connection failed');
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.logo}>🤖</Text>
            <Text style={styles.title}>AI Trading Bot</Text>
            <Text style={styles.subtitle}>Binance spot trading powered by a 7-factor AI signal engine</Text>
          </View>

          <Card>
            <View style={styles.statusRow}>
              <StatusDot ok={restStatus === 'ok'} />
              <Text style={styles.statusText}>
                {restStatus === 'ok' ? 'Connected to Binance' : restStatus === 'fail' ? 'Connection failed' : 'Not connected'}
              </Text>
              {env === 'testnet' ? (
                <Badge text="TESTNET" tone="info" small />
              ) : (
                <Badge text="LIVE" tone="gold" small />
              )}
            </View>

            <Field
              label="Binance API Key"
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="64-character API key"
              hint="Settings → API Management → Create API (enable “Enable Spot & Margin Trading”)"
            />
            <Field
              label="Binance Secret Key"
              value={apiSecret}
              onChangeText={setApiSecret}
              placeholder="64-character secret key"
              secure
              hint="Encrypted on-device with AES-256-GCM before storage"
            />

            <Text style={styles.fieldLabel}>Environment</Text>
            <Segmented
              options={[
                { value: 'testnet' as Environment, label: 'Testnet (safe)' },
                { value: 'live' as Environment, label: 'Live trading' },
              ]}
              value={env}
              onChange={pickEnv}
            />
            <Text style={styles.envHint}>
              {env === 'testnet'
                ? `${ENVIRONMENTS.testnet.label} — simulated funds, nothing real at risk.`
                : 'Real orders on your Binance account. Double-check every setting.'}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label={busy ? 'Testing connection…' : 'Connect & Save'} onPress={connect} loading={busy} style={{ marginTop: 12 }} />
          </Card>

          <Card>
            <Text style={styles.securityTitle}>🔒 Security model</Text>
            <Text style={styles.securityText}>
              • Keys are encrypted with AES-256-GCM; the master key lives in Android Keystore via SecureStore.{'\n'}
              • Biometric (fingerprint / face) unlock can be enabled after setup.{'\n'}
              • Withdrawals are never possible with a trading key — the app only reads balances and places spot orders.{'\n'}
              • Prefer IP-restricted keys tied to your phone’s network.
            </Text>
          </Card>

          <Text style={styles.disclaimer}>
            ⚠️ Trading cryptocurrencies carries substantial risk. This bot is a tool, not financial
            advice. Start on testnet, use small sizes, and never trade money you cannot afford to lose.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={liveWarn}
        title="Enable live trading?"
        message="Live mode places REAL market orders with REAL funds on your Binance account. The AI can lose money. Make sure you understand the risk before continuing."
        confirmLabel="I understand — use Live"
        danger
        onCancel={() => {
          setLiveWarn(false);
          setEnv('testnet');
        }}
        onConfirm={() => {
          setLiveWarn(false);
          setEnv('live');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginVertical: 22 },
  logo: { fontSize: 46 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 8 },
  subtitle: { color: colors.textDim, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  statusText: { color: colors.textDim, fontSize: 13, flex: 1 },
  fieldLabel: { color: colors.textDim, fontSize: 12, marginBottom: 6, fontWeight: '600', marginTop: 4 },
  envHint: { color: colors.textFaint, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  error: { color: colors.red, fontSize: 12.5, marginTop: 10, lineHeight: 17 },
  securityTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  securityText: { color: colors.textDim, fontSize: 12, lineHeight: 19 },
  disclaimer: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
  },
});
