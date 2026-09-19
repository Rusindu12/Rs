import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { useAppDispatch, useAppSelector } from '../store/store';
import { updateSettings, setPaperTrade, setAutoTrade, setStrategy } from '../store/slices/settingsSlice';
import { Card } from '../components/common/Card';
import { Toggle } from '../components/common/Toggle';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { STRATEGY_PRESETS, TradingStrategy } from '../types/app';

interface BotSettingsProps { navigation: any; }

export const BotSettingsScreen: React.FC<BotSettingsProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector(state => state.settings);

  const handleStrategyChange = (strategy: TradingStrategy) => {
    const preset = STRATEGY_PRESETS[strategy];
    dispatch(setStrategy(strategy));
    dispatch(updateSettings({
      maxTradePct: preset.maxTradePct,
      dailyLossLimit: preset.dailyLossLimit,
      maxDrawdownPct: preset.maxDrawdownPct,
      defaultSlPct: preset.defaultSlPct,
      defaultTpPct: preset.defaultTpPct,
      trailingStopPct: preset.trailingStopPct,
      minConfidence: preset.minConfidence,
      maxOpenTrades: preset.maxOpenTrades,
      cooldownSeconds: preset.cooldownSeconds,
    }));
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Bot Settings</Text>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Trading Mode</Text>
          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Paper Trading</Text>
              <Text style={styles.desc}>Trade with virtual money using real market data</Text>
            </View>
            <Toggle value={settings.isPaperTrade} onValueChange={(v) => {
              if (!v) {
                Alert.alert('⚠️ Go Live?', 'This will enable REAL trading with REAL money. Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Go Live', style: 'destructive', onPress: () => dispatch(setPaperTrade(false)) },
                ]);
              } else {
                dispatch(setPaperTrade(true));
              }
            }} />
          </View>
          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Auto Trade</Text>
              <Text style={styles.desc}>Automatically execute signals that meet criteria</Text>
            </View>
            <Toggle value={settings.isAutoTrade} onValueChange={(v) => dispatch(setAutoTrade(v))} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Strategy</Text>
          {(Object.keys(STRATEGY_PRESETS) as TradingStrategy[]).map(strategy => (
            <Button key={strategy} title={`${STRATEGY_PRESETS[strategy].name.charAt(0).toUpperCase() + strategy.slice(1)} - ${STRATEGY_PRESETS[strategy].description}`}
              onPress={() => handleStrategyChange(strategy)} variant={settings.strategy === strategy ? 'primary' : 'ghost'}
              size="small" fullWidth style={{ marginBottom: Spacing.sm }} />
          ))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Risk Parameters</Text>
          <Input label="Max Trade (% of portfolio)" value={String(settings.maxTradePct)} onChangeText={(v) => dispatch(updateSettings({ maxTradePct: parseFloat(v) || 0 }))} keyboardType="numeric" />
          <Input label="Daily Loss Limit (%)" value={String(settings.dailyLossLimit)} onChangeText={(v) => dispatch(updateSettings({ dailyLossLimit: parseFloat(v) || 0 }))} keyboardType="numeric" />
          <Input label="Max Drawdown (%)" value={String(settings.maxDrawdownPct)} onChangeText={(v) => dispatch(updateSettings({ maxDrawdownPct: parseFloat(v) || 0 }))} keyboardType="numeric" />
          <Input label="Stop Loss (%)" value={String(settings.defaultSlPct)} onChangeText={(v) => dispatch(updateSettings({ defaultSlPct: parseFloat(v) || 0 }))} keyboardType="numeric" />
          <Input label="Take Profit (%)" value={String(settings.defaultTpPct)} onChangeText={(v) => dispatch(updateSettings({ defaultTpPct: parseFloat(v) || 0 }))} keyboardType="numeric" />
          <Input label="Min Confidence (%)" value={String(settings.minConfidence)} onChangeText={(v) => dispatch(updateSettings({ minConfidence: parseInt(v) || 0 }))} keyboardType="numeric" />
          <Input label="Max Open Trades" value={String(settings.maxOpenTrades)} onChangeText={(v) => dispatch(updateSettings({ maxOpenTrades: parseInt(v) || 0 }))} keyboardType="numeric" />
          <Input label="Cooldown (seconds)" value={String(settings.cooldownSeconds)} onChangeText={(v) => dispatch(updateSettings({ cooldownSeconds: parseInt(v) || 0 }))} keyboardType="numeric" />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Auto-start</Text>
          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Start on Boot</Text>
              <Text style={styles.desc}>Auto-start trading when phone restarts</Text>
            </View>
            <Toggle value={settings.autoStartOnBoot} onValueChange={(v) => dispatch(updateSettings({ autoStartOnBoot: v }))} />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.xl },
  card: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h4, color: Colors.primary, marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { ...Typography.body1, color: Colors.textPrimary },
  desc: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
});
