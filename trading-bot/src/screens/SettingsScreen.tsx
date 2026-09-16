import React, { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, CardTitle, ConfirmModal, Field, Row, Screen, Segmented, Toggle } from '../components/ui';
import { colors } from '../theme';
import { DEFAULT_SYMBOLS, TOP_TICKERS, type Environment } from '../config';
import { runtime } from '../engine/runtime';
import { useAuthStore } from '../store/authStore';
import { useBotStore } from '../store/botStore';

export function SettingsScreen() {
  const config = useBotStore((s) => s.config);
  const setConfig = useBotStore((s) => s.setConfig);
  const environment = useAuthStore((s) => s.environment);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const biometricAvailable = useAuthStore((s) => s.biometricAvailable);

  const [forgetOpen, setForgetOpen] = useState(false);
  const [liveSwitch, setLiveSwitch] = useState(false);
  const [saved, setSaved] = useState(false);

  const num = (v: string) => {
    const n = Number(v);
    return isFinite(n) && n >= 0 ? n : 0;
  };

  const save = async () => {
    await runtime.saveBotConfig();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const toggleBiometric = async (v: boolean) => {
    if (v) {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      useAuthStore.getState().setBiometricAvailable(has && enrolled);
      if (!has || !enrolled) return; // UI hint below explains
    }
    await runtime.setBiometricEnabled(v);
  };

  return (
    <Screen>
      {/* Strategy */}
      <Card>
        <CardTitle right={saved ? <Badge text="SAVED ✓" tone="buy" small /> : undefined}>STRATEGY SETTINGS</CardTitle>

        <Text style={styles.label}>Watchlist</Text>
        <View style={styles.symbolsWrap}>
          {TOP_TICKERS.map((sym) => {
            const on = config.symbols.includes(sym);
            return (
              <View
                key={sym}
                style={[styles.symbolChip, on && styles.symbolChipOn]}
              >
                <Text
                  style={[styles.symbolChipText, on && styles.symbolChipTextOn]}
                  onPress={() => {
                    const next = on
                      ? config.symbols.filter((s) => s !== sym)
                      : [...config.symbols, sym];
                    setConfig({ symbols: next.length ? next : [DEFAULT_SYMBOLS[0]] });
                  }}
                >
                  {sym.replace('USDT', '')}
                </Text>
              </View>
            );
          })}
        </View>

        <Field
          label="Trade size per position (USDT)"
          value={String(config.tradeAmountUsdt)}
          onChangeText={(v) => setConfig({ tradeAmountUsdt: num(v) })}
          keyboardType="numeric"
        />
        <Field
          label="Max simultaneous open trades"
          value={String(config.maxOpenTrades)}
          onChangeText={(v) => setConfig({ maxOpenTrades: Math.max(1, Math.min(10, num(v))) })}
          keyboardType="numeric"
        />
        <Field
          label="Stop loss (%)"
          value={String(config.stopLossPct)}
          onChangeText={(v) => setConfig({ stopLossPct: num(v) })}
          keyboardType="numeric"
          hint="Automatic exit when a position drops this far below entry"
        />
        <Field
          label="Take profit (%)"
          value={String(config.takeProfitPct)}
          onChangeText={(v) => setConfig({ takeProfitPct: num(v) })}
          keyboardType="numeric"
          hint="Automatic exit when a position gains this much"
        />
        <Field
          label="Daily loss circuit breaker (%)"
          value={String(config.dailyLossLimitPct)}
          onChangeText={(v) => setConfig({ dailyLossLimitPct: num(v) })}
          keyboardType="numeric"
          hint="Pauses new entries once daily realized losses reach this share of equity"
        />

        <Text style={styles.label}>Minimum signal to trade</Text>
        <Segmented
          options={[
            { value: 'STRONG_BUY' as const, label: 'Strong only' },
            { value: 'BUY' as const, label: 'Buy+' },
          ]}
          value={config.minSignal === 'STRONG_BUY' ? 'STRONG_BUY' : 'BUY'}
          onChange={(v) => setConfig({ minSignal: v })}
        />

        <Field
          label="Analysis cycle (seconds)"
          value={String(Math.round(config.pollIntervalMs / 1000))}
          onChangeText={(v) => setConfig({ pollIntervalMs: Math.max(15, num(v)) * 1000 })}
          keyboardType="numeric"
        />

        <Button label="Save strategy" onPress={save} />
      </Card>

      {/* Security */}
      <Card>
        <CardTitle>SECURITY</CardTitle>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.toggleTitle}>Biometric app lock</Text>
            <Text style={styles.toggleHint}>
              {biometricAvailable || biometricEnabled
                ? 'Fingerprint / face required to open the app.'
                : biometricAvailable === false && biometricEnabled === false
                ? 'No biometric hardware or enrolment detected on this device.'
                : 'Enrol a fingerprint or face in Android settings first.'}
            </Text>
          </View>
          <Toggle value={biometricEnabled} onChange={(v) => void toggleBiometric(v)} />
        </View>
      </Card>

      {/* Environment */}
      <Card>
        <CardTitle>ENVIRONMENT</CardTitle>
        <Segmented
          options={[
            { value: 'testnet' as Environment, label: 'Testnet (safe)' },
            { value: 'live' as Environment, label: 'Live trading' },
          ]}
          value={environment}
          onChange={(e) => {
            if (e === 'live') setLiveSwitch(true);
            else void runtime.switchEnvironment('testnet');
          }}
        />
        <Text style={styles.toggleHint}>
          {environment === 'testnet'
            ? 'Simulated funds on the Binance spot testnet.'
            : '⚠️ Real orders are placed on your Binance account.'}
        </Text>
      </Card>

      {/* About */}
      <Card>
        <CardTitle>ABOUT</CardTitle>
        <Row left="App" right="AI Trading Bot v1.0.0" />
        <Row left="Engine" right="7-factor score + 5-timeframe confluence" />
        <Row left="Indicators" right="RSI · MACD · BBands · EMA · Stoch · ATR · VWAP · Ichimoku · Fib · Volume Profile" />
        <Row left="Credential storage" right="AES-256-GCM + Android Keystore" />
      </Card>

      {/* Danger zone */}
      <Card style={{ borderColor: colors.red }}>
        <CardTitle>DANGER ZONE</CardTitle>
        <Button label="Erase API keys from this device" tone="danger" onPress={() => setForgetOpen(true)} />
      </Card>

      <Text style={styles.disclaimer}>
        ⚠️ This software is provided for educational purposes. Cryptocurrency trading is highly
        volatile and can result in the total loss of your funds. Past performance of any strategy
        does not guarantee future results. You are solely responsible for trades executed by the bot.
      </Text>

      <ConfirmModal
        visible={liveSwitch}
        title="Switch to LIVE trading?"
        message="From now on the bot places real market orders with real funds. Testnet positions stay in the paper ledger and are unaffected."
        confirmLabel="Enable live trading"
        danger
        onCancel={() => setLiveSwitch(false)}
        onConfirm={() => {
          setLiveSwitch(false);
          void runtime.switchEnvironment('live');
        }}
      />
      <ConfirmModal
        visible={forgetOpen}
        title="Erase stored credentials?"
        message="The encrypted API key/secret and all local bot data on this phone will be deleted. Open positions on Binance itself are not cancelled — close them manually or via the bot first."
        confirmLabel="Erase everything"
        danger
        onCancel={() => setForgetOpen(false)}
        onConfirm={async () => {
          setForgetOpen(false);
          await runtime.forgetCredentials();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: 8 },
  symbolsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  symbolChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bgElevated,
  },
  symbolChipOn: { borderColor: colors.gold, backgroundColor: '#F0B90B1A' },
  symbolChipText: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  symbolChipTextOn: { color: colors.gold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  toggleTitle: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  toggleHint: { color: colors.textFaint, fontSize: 11.5, marginTop: 6, lineHeight: 16 },
  disclaimer: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: 4,
  },
});
