import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Colors, getPnlColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../theme/spacing';
import { useAppSelector, useAppDispatch } from '../store/store';
import { formatCurrency, formatPnl, formatPercentage } from '../utils/priceFormatter';
import { ServiceStatusBadge } from '../components/ServiceStatusBadge';
import { PanicButton } from '../components/PanicButton';
import { SignalCard } from '../components/SignalCard';
import { FearGreedMeter } from '../components/FearGreedMeter';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

interface DashboardProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { portfolioValue, dailyPnl, openTrades, stats } = useAppSelector(state => state.trades);
  const { signals } = useAppSelector(state => state.signals);
  const { isActive, isBackgroundRunning, uptime, serviceHealth } = useAppSelector(state => state.bot);
  const { isPaperTrade } = useAppSelector(state => state.settings.settings);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const pnlColor = getPnlColor(dailyPnl);
  const winRate = stats?.winRate || 0;
  const recentSignals = signals.slice(0, 3);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>CryptoSignal AI</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
          </View>
          <ServiceStatusBadge isActive={isActive} uptime={uptime} health={serviceHealth} />
        </View>

        {isPaperTrade && (
          <View style={styles.paperBanner}>
            <Text style={styles.paperText}>📝 Paper Trading Mode</Text>
          </View>
        )}

        <Card style={styles.portfolioCard}>
          <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
          <Text style={styles.portfolioValue}>{formatCurrency(portfolioValue)}</Text>
          <View style={styles.pnlRow}>
            <Text style={[styles.pnlValue, { color: pnlColor }]}>{formatPnl(dailyPnl)}</Text>
            <Text style={[styles.pnlPercent, { color: pnlColor }]}>
              {portfolioValue > 0 ? formatPercentage((dailyPnl / portfolioValue) * 100) : '+0.00%'}
            </Text>
            <Text style={styles.pnlLabel}>24h PnL</Text>
          </View>
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{openTrades.length}</Text>
            <Text style={styles.statLabel}>Active Trades</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{signals.length}</Text>
            <Text style={styles.statLabel}>Signals Today</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.buy }]}>{winRate.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </Card>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isActive ? Colors.sell : Colors.buy }]}
            onPress={() => {}}>
            <Text style={styles.actionEmoji}>{isActive ? '⏹' : '▶️'}</Text>
            <Text style={styles.actionText}>{isActive ? 'Stop Bot' : 'Start Bot'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.info }]}
            onPress={() => navigation.navigate('Signals')}>
            <Text style={styles.actionEmoji}>📊</Text>
            <Text style={styles.actionText}>Signals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.card }]}
            onPress={() => navigation.navigate('Charts')}>
            <Text style={styles.actionEmoji}>📈</Text>
            <Text style={styles.actionText}>Charts</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Latest Signals</Text>
        {recentSignals.length > 0 ? recentSignals.map((signal, i) => (
          <SignalCard key={i} signal={signal} onPress={() => navigation.navigate('Signals')} onTrade={() => navigation.navigate('Trading', { signal })} />
        )) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No signals yet. Start the bot to begin scanning.</Text>
          </Card>
        )}

        <FearGreedMeter value={50} label="Neutral" />

        <View style={{ marginTop: Spacing.xl }}>
          <PanicButton onPress={async () => {}} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  greeting: { ...Typography.h2, color: Colors.textPrimary },
  date: { ...Typography.body2, color: Colors.textTertiary, marginTop: 2 },
  paperBanner: { backgroundColor: 'rgba(248,166,19,0.15)', padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.lg, alignItems: 'center' },
  paperText: { ...Typography.body2, color: Colors.warning },
  portfolioCard: { marginBottom: Spacing.lg, alignItems: 'center', paddingVertical: Spacing.xl },
  portfolioLabel: { ...Typography.caption, color: Colors.textTertiary },
  portfolioValue: { ...Typography.price, color: Colors.textPrimary, marginTop: Spacing.xs },
  pnlRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.sm },
  pnlValue: { ...Typography.h4 },
  pnlPercent: { ...Typography.body2 },
  pnlLabel: { ...Typography.caption, color: Colors.textTertiary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statValue: { ...Typography.h3, color: Colors.textPrimary },
  statLabel: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  quickActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  actionEmoji: { fontSize: 24 },
  actionText: { ...Typography.caption, color: Colors.textPrimary, marginTop: 4 },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.md },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { ...Typography.body2, color: Colors.textTertiary },
});
