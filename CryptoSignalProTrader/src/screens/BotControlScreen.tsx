import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useAppSelector } from '../store/store';
import { useBackgroundService } from '../hooks/useBackgroundService';
import { formatPnl } from '../utils/priceFormatter';
import { secondsToHumanReadable } from '../utils/timeHelpers';
import { Card } from '../components/common/Card';
import { Toggle } from '../components/common/Toggle';
import { Button } from '../components/common/Button';
import { PanicButton } from '../components/PanicButton';
import { ServiceStatusBadge } from '../components/ServiceStatusBadge';

interface BotControlProps { navigation: any; }

export const BotControlScreen: React.FC<BotControlProps> = ({ navigation }) => {
  const bot = useAppSelector(state => state.bot);
  const { settings } = useAppSelector(state => state.settings);
  const { isActive, isBackgroundRunning, toggleBot, emergencyStop } = useBackgroundService();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Bot Control Center</Text>

        <Card style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Auto Trading</Text>
              <Text style={styles.toggleDesc}>{isActive ? 'Bot is actively scanning and trading' : 'Bot is stopped'}</Text>
            </View>
            <Toggle value={isActive} onValueChange={toggleBot} />
          </View>
          <ServiceStatusBadge isActive={isActive} uptime={bot.uptime} health={bot.serviceHealth} />
        </Card>

        <View style={styles.statsGrid}>
          <Card style={styles.gridCard}>
            <Text style={styles.gridLabel}>Uptime</Text>
            <Text style={styles.gridValue}>{secondsToHumanReadable(bot.uptime)}</Text>
          </Card>
          <Card style={styles.gridCard}>
            <Text style={styles.gridLabel}>Signals</Text>
            <Text style={styles.gridValue}>{bot.signalsGenerated}</Text>
          </Card>
          <Card style={styles.gridCard}>
            <Text style={styles.gridLabel}>Trades</Text>
            <Text style={styles.gridValue}>{bot.tradesExecuted}</Text>
          </Card>
          <Card style={styles.gridCard}>
            <Text style={styles.gridLabel}>Today PnL</Text>
            <Text style={[styles.gridValue, { color: bot.currentPnl >= 0 ? Colors.buy : Colors.sell }]}>{formatPnl(bot.currentPnl)}</Text>
          </Card>
        </View>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Background Service</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: isBackgroundRunning ? Colors.buy : Colors.textTertiary }]}>
              {isBackgroundRunning ? 'Running' : 'Stopped'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Auto-start on Boot</Text>
            <Text style={styles.infoValue}>{settings.autoStartOnBoot ? 'Yes' : 'No'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Trading Mode</Text>
            <Text style={[styles.infoValue, { color: settings.isPaperTrade ? Colors.warning : Colors.danger }]}>
              {settings.isPaperTrade ? 'Paper' : 'LIVE'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Strategy</Text>
            <Text style={styles.infoValue}>{settings.strategy}</Text>
          </View>
        </Card>

        <Card style={styles.pairsCard}>
          <Text style={styles.infoTitle}>Active Pairs ({bot.activePairs.length})</Text>
          <View style={styles.pairsList}>
            {bot.activePairs.map(pair => (
              <View key={pair} style={styles.pairBadge}>
                <Text style={styles.pairText}>{pair.replace('USDT', '/USDT')}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Service Logs</Text>
        <Card style={styles.logsCard}>
          {bot.logs.slice(-10).map((log, i) => (
            <Text key={i} style={styles.logLine}>{log}</Text>
          ))}
          {bot.logs.length === 0 && <Text style={styles.emptyLogs}>No logs yet</Text>}
        </Card>

        <View style={{ marginTop: Spacing.xl }}>
          <PanicButton onPress={emergencyStop} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.xl },
  toggleCard: { marginBottom: Spacing.lg },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  toggleTitle: { ...Typography.h4, color: Colors.textPrimary },
  toggleDesc: { ...Typography.body2, color: Colors.textTertiary, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  gridCard: { width: '48%', alignItems: 'center', paddingVertical: Spacing.md },
  gridLabel: { ...Typography.overline, color: Colors.textTertiary },
  gridValue: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.xs },
  infoCard: { marginBottom: Spacing.lg },
  infoTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { ...Typography.body2, color: Colors.textSecondary },
  infoValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },
  pairsCard: { marginBottom: Spacing.lg },
  pairsList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pairBadge: { backgroundColor: Colors.cardHover, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round },
  pairText: { ...Typography.caption, color: Colors.textPrimary },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.md },
  logsCard: { maxHeight: 200 },
  logLine: { ...Typography.monoSmall, color: Colors.textSecondary, marginBottom: 2 },
  emptyLogs: { ...Typography.body2, color: Colors.textTertiary, textAlign: 'center' },
});
