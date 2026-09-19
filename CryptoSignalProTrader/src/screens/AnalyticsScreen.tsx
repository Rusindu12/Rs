import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Colors, getPnlColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useAppSelector } from '../store/store';
import { formatCurrency, formatPnl, formatPercentage } from '../utils/priceFormatter';
import { Card } from '../components/common/Card';

const screenWidth = Dimensions.get('window').width;

interface AnalyticsProps { navigation: any; }

export const AnalyticsScreen: React.FC<AnalyticsProps> = ({ navigation }) => {
  const { stats, closedTrades, totalPnl, portfolioValue } = useAppSelector(state => state.trades);
  const winRate = stats?.winRate || 0;
  const totalTrades = stats?.totalTrades || 0;
  const wins = closedTrades.filter(t => (t.netPnl || 0) > 0);
  const losses = closedTrades.filter(t => (t.netPnl || 0) <= 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.netPnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.netPnl || 0), 0) / losses.length : 0;

  const monthlyPnl: Record<string, number> = {};
  closedTrades.forEach(t => {
    if (t.closedAt) {
      const month = t.closedAt.substring(0, 7);
      monthlyPnl[month] = (monthlyPnl[month] || 0) + (t.netPnl || 0);
    }
  });

  const pairPerformance: Record<string, { pnl: number; count: number }> = {};
  closedTrades.forEach(t => {
    if (!pairPerformance[t.symbol]) pairPerformance[t.symbol] = { pnl: 0, count: 0 };
    pairPerformance[t.symbol].pnl += t.netPnl || 0;
    pairPerformance[t.symbol].count++;
  });

  const sortedPairs = Object.entries(pairPerformance).sort((a, b) => b[1].pnl - a[1].pnl);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>AI Analytics</Text>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Win Rate</Text>
              <Text style={[styles.gridValue, { color: Colors.buy }]}>{winRate.toFixed(1)}%</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Total Trades</Text>
              <Text style={styles.gridValue}>{totalTrades}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Net PnL</Text>
              <Text style={[styles.gridValue, { color: getPnlColor(totalPnl) }]}>{formatPnl(totalPnl)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Avg Win</Text>
              <Text style={[styles.gridValue, { color: Colors.buy }]}>${avgWin.toFixed(2)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Avg Loss</Text>
              <Text style={[styles.gridValue, { color: Colors.sell }]}>${avgLoss.toFixed(2)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Sharpe Ratio</Text>
              <Text style={styles.gridValue}>{(stats?.sharpeRatio || 0).toFixed(2)}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Win/Loss Distribution</Text>
          <View style={styles.wlBar}>
            <View style={[styles.winBar, { flex: wins.length || 0.1 }]} />
            <View style={[styles.lossBar, { flex: losses.length || 0.1 }]} />
          </View>
          <View style={styles.wlLabels}>
            <Text style={styles.winLabel}>Wins: {wins.length}</Text>
            <Text style={styles.lossLabel}>Losses: {losses.length}</Text>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Monthly PnL</Text>
          {Object.entries(monthlyPnl).slice(-6).map(([month, pnl]) => {
            const maxPnl = Math.max(...Object.values(monthlyPnl).map(Math.abs));
            const barWidth = maxPnl > 0 ? (Math.abs(pnl) / maxPnl) * (screenWidth - 120) : 0;
            return (
              <View key={month} style={styles.monthRow}>
                <Text style={styles.monthLabel}>{month}</Text>
                <View style={styles.monthBar}>
                  <View style={[styles.monthFill, { width: barWidth, backgroundColor: pnl >= 0 ? Colors.buy : Colors.sell }]} />
                </View>
                <Text style={[styles.monthValue, { color: getPnlColor(pnl) }]}>{formatPnl(pnl)}</Text>
              </View>
            );
          })}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Best & Worst Pairs</Text>
          {sortedPairs.slice(0, 5).map(([symbol, data]) => (
            <View key={symbol} style={styles.pairRow}>
              <Text style={styles.pairName}>{symbol.replace('USDT', '/USDT')}</Text>
              <Text style={styles.pairTrades}>{data.count} trades</Text>
              <Text style={[styles.pairPnl, { color: getPnlColor(data.pnl) }]}>{formatPnl(data.pnl)}</Text>
            </View>
          ))}
          {sortedPairs.length === 0 && <Text style={styles.noData}>No trade data available</Text>}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Risk Metrics</Text>
          <View style={styles.riskRow}>
            <Text style={styles.riskLabel}>Max Drawdown</Text>
            <Text style={[styles.riskValue, { color: Colors.danger }]}>-{(stats?.maxDrawdown || 0).toFixed(2)}%</Text>
          </View>
          <View style={styles.riskRow}>
            <Text style={styles.riskLabel}>Profit Factor</Text>
            <Text style={styles.riskValue}>{(stats?.profitFactor || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.riskRow}>
            <Text style={styles.riskLabel}>Max Win Streak</Text>
            <Text style={[styles.riskValue, { color: Colors.buy }]}>{stats?.maxConsecutiveWins || 0}</Text>
          </View>
          <View style={styles.riskRow}>
            <Text style={styles.riskLabel}>Max Loss Streak</Text>
            <Text style={[styles.riskValue, { color: Colors.sell }]}>{stats?.maxConsecutiveLosses || 0}</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%', paddingVertical: Spacing.sm },
  gridLabel: { ...Typography.overline, color: Colors.textTertiary },
  gridValue: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.xs },
  wlBar: { flexDirection: 'row', height: 24, borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.sm },
  winBar: { backgroundColor: Colors.buy },
  lossBar: { backgroundColor: Colors.sell },
  wlLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  winLabel: { ...Typography.caption, color: Colors.buy },
  lossLabel: { ...Typography.caption, color: Colors.sell },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  monthLabel: { ...Typography.caption, color: Colors.textTertiary, width: 60 },
  monthBar: { flex: 1, height: 16, backgroundColor: Colors.cardDark, borderRadius: 4, marginHorizontal: Spacing.sm, overflow: 'hidden' },
  monthFill: { height: 16, borderRadius: 4 },
  monthValue: { ...Typography.monoSmall, width: 70, textAlign: 'right' },
  pairRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pairName: { ...Typography.body2, color: Colors.textPrimary, flex: 1 },
  pairTrades: { ...Typography.caption, color: Colors.textTertiary, marginRight: Spacing.md },
  pairPnl: { ...Typography.monoSmall },
  noData: { ...Typography.body2, color: Colors.textTertiary, textAlign: 'center' },
  riskRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  riskLabel: { ...Typography.body2, color: Colors.textSecondary },
  riskValue: { ...Typography.mono, color: Colors.textPrimary },
});
