import React, { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
  const demoMode = useAuthStore((s) => s.demoMode);
  const hasCredentials = useAuthStore((s) => s.credentials) !== null;
  const [learning, setLearning] = useState(runtime.learningSummary());
  const [health, setHealth] = useState(runtime.engineHealth());

  const refreshLearning = () => {
    setLearning(runtime.learningSummary());
    setHealth(runtime.engineHealth());
  };

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
    if (Platform.OS === 'web') return; // biometrics need native hardware
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

        {/* AI v2 toggles */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.toggleTitle}>ATR-aware stops</Text>
            <Text style={styles.toggleHint}>
              Widens stop-loss / take-profit with market volatility (max 2× your %), so volatile coins aren't clipped instantly.
            </Text>
          </View>
          <Toggle value={config.useAtrStops} onChange={(v) => setConfig({ useAtrStops: v })} />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.toggleTitle}>Confidence-based sizing</Text>
            <Text style={styles.toggleHint}>
              Scales each position between 0.75×–1× of your trade size by AI confidence (100% = full size).
            </Text>
          </View>
          <Toggle value={config.confidenceSizing} onChange={(v) => setConfig({ confidenceSizing: v })} />
        </View>

        <Text style={styles.label}>Trade frequency</Text>
        <Segmented
          options={[
            { value: 'chill' as const, label: 'Chill' },
            { value: 'normal' as const, label: 'Normal' },
            { value: 'turbo' as const, label: 'Turbo' },
          ]}
          value={config.tradeMode ?? 'normal'}
          onChange={(v) =>
            setConfig({
              tradeMode: v,
              minSignal: v === 'chill' ? 'BUY' : config.minSignal,
            })
          }
        />
        <Text style={styles.toggleHint}>
          {config.tradeMode === 'chill'
            ? 'Only confirmed BUY/STRONG_BUY signals (score ≥ 30) open trades. Fewer, higher-quality entries.'
            : config.tradeMode === 'normal'
              ? 'Opens trades from score ≥ 20 — recommended. Steady trading without chasing noise.'
              : 'Opens trades from score ≥ 12 and bypasses the trend gate. Most trades — expect more noise.'}
        </Text>

        <Text style={styles.label}>Minimum signal (Chill mode)</Text>
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

      {/* AI training */}
      <Card>
        <CardTitle right={<Badge text={learning.trained.adopted ? 'TRAINED ✓' : 'SPEC DEFAULTS'} tone={learning.trained.adopted ? 'buy' : 'neutral'} small />}>
          🧠 AI TRAINING
        </CardTitle>
        <Row left="Last trained" right={new Date(learning.trained.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} />
        <Row left="Training data" right={learning.trained.source === 'binance-live' ? 'live Binance history' : learning.trained.source} />
        <Row
          left="Decision accuracy (test)"
          right={`${learning.trained.classAcc.toFixed(1)}%`}
          rightStyle={{ color: colors.green, fontWeight: '800' }}
        />
        <Row left="BUY / SELL / HOLD accuracy" right={`${learning.trained.buyAcc != null ? learning.trained.buyAcc.toFixed(0) + '%' : '—'} / ${learning.trained.sellAcc != null ? learning.trained.sellAcc.toFixed(0) + '%' : '—'} / ${learning.trained.holdAcc != null ? learning.trained.holdAcc.toFixed(0) + '%' : '—'}`} />
        <Row left="Live-learned signals" right={`${learning.adaptive.evaluated} evaluated · ${learning.adaptive.accuracy.toFixed(0)}% correct`} />
        {Object.keys(learning.scales).length ? (
          <Row
            left="Adaptive factor scales"
            right={Object.entries(learning.scales).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(2)}×`).join(' · ') + (Object.keys(learning.scales).length > 3 ? ' …' : '')}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Button label="⟳ Refresh" tone="ghost" onPress={refreshLearning} style={{ flex: 1 }} />
          <Button label="Reset learning" tone="ghost" onPress={() => void runtime.resetAdaptive().then(refreshLearning)} style={{ flex: 1 }} />
        </View>
        <Text style={styles.toggleHint}>
          Weights are re-trained on real Binance history in CI before every build, and keep
          adapting on-device from each signal's outcome (bounded 0.6–1.4× so the AI can't drift wild).
        </Text>
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

      {/* Demo mode / environment */}
      {demoMode && !hasCredentials ? (
        <Card style={{ borderColor: colors.gold }}>
          <CardTitle>DEMO MODE</CardTitle>
          <Text style={styles.toggleHint}>
            Running with live market data and paper trading ($10,000 simulated). Connect
            your Binance API keys to unlock real testnet/live trading.
          </Text>
          <Button label="🔑 Connect API keys" onPress={() => void runtime.disableDemoMode()} style={{ marginTop: 10 }} />
        </Card>
      ) : (
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
      )}

      {/* About */}
      <Card>
        <CardTitle>ABOUT</CardTitle>
        <Row left="App" right="AI Trading Bot v1.0.0" />
        <Row left="Engine" right="AI v2 — 11 scored factors + 5-TF confluence" />
        <Row left="Patterns" right="Engulfing · Hammer · Stars · Doji + RSI divergence" />
        <Row left="Regime" right="ADX trend gate · ATR stops · confidence sizing" />
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
          {/* Engine diagnostics */}
      <Card>
        <CardTitle right={<Badge text={health.wsConnected ? 'FEED OK' : 'FEED DOWN'} tone={health.wsConnected ? 'buy' : 'sell'} small />}>
          🩺 ENGINE DIAGNOSTICS
        </CardTitle>
        <Row left="Market data host" right={health.restBase.replace('https://', '')} />
        <Row left="Candle sets cached" right={String(health.klinesCached)} />
        <Row left="Data fetch failures" right={String(health.dataFailures)} />
        {health.lastDataError ? <Row left="Last data error" right={health.lastDataError} /> : null}
        <Text style={styles.toggleHint}>
          If market data host shows "connecting…" and failures keep rising, your network is blocking
          Binance — the app automatically retries mirror endpoints (data.binance.vision).
        </Text>
      </Card>
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
