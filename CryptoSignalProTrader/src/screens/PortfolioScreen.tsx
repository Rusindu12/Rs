import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, getPnlColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useAppSelector } from '../store/store';
import { formatCurrency, formatPnl, formatPairName, formatPrice } from '../utils/priceFormatter';
import { Card } from '../components/common/Card';
import { TradeCard } from '../components/TradeCard';

interface PortfolioProps { navigation: any; }

export const PortfolioScreen: React.FC<PortfolioProps> = ({ navigation }) => {
  const { portfolioValue, openTrades, dailyPnl, weeklyPnl, totalPnl, peakPortfolioValue } = useAppSelector(state => state.trades);
  const { isPaperTrade } = useAppSelector(state => state.settings.settings);

  const drawdown = peakPortfolioValue > 0 ? ((peakPortfolioValue - portfolioValue) / peakPortfolioValue) * 100 : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Portfolio</Text>
        {isPaperTrade && <Text style={styles.paperLabel}>📝 Paper Portfolio</Text>}

        <Card style={styles.valueCard}>
          <Text style={styles.valueLabel}>Total Value</Text>
          <Text style={styles.valueAmount}>{formatCurrency(portfolioValue)}</Text>
          <View style={styles.pnlRow}>
            <View style={styles.pnlItem}>
              <Text style={styles.pnlLabel}>Today</Text>
              <Text style={[styles.pnlValue, { color: getPnlColor(dailyPnl) }]}>{formatPnl(dailyPnl)}</Text>
            </View>
            <View style={styles.pnlItem}>
              <Text style={styles.pnlLabel}>Week</Text>
              <Text style={[styles.pnlValue, { color: getPnlColor(weeklyPnl) }]}>{formatPnl(weeklyPnl)}</Text>
            </View>
            <View style={styles.pnlItem}>
              <Text style={styles.pnlLabel}>All Time</Text>
              <Text style={[styles.pnlValue, { color: getPnlColor(totalPnl) }]}>{formatPnl(totalPnl)}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Open Positions</Text>
            <Text style={styles.statValue}>{openTrades.length}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Max Drawdown</Text>
            <Text style={[styles.statValue, { color: Colors.danger }]}>{drawdown.toFixed(2)}%</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>Open Positions</Text>
        {openTrades.length > 0 ? openTrades.map((trade) => (
          <TradeCard key={trade.id} trade={trade} onPress={() => {}} />
        )) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>No open positions</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { ...Typography.h2, color: Colors.textPrimary },
  paperLabel: { ...Typography.caption, color: Colors.warning, marginTop: Spacing.xs },
  valueCard: { marginVertical: Spacing.lg, alignItems: 'center', paddingVertical: Spacing.xl },
  valueLabel: { ...Typography.caption, color: Colors.textTertiary },
  valueAmount: { ...Typography.price, color: Colors.textPrimary, marginTop: Spacing.xs },
  pnlRow: { flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.xxl },
  pnlItem: { alignItems: 'center' },
  pnlLabel: { ...Typography.overline, color: Colors.textTertiary },
  pnlValue: { ...Typography.h4, marginTop: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statLabel: { ...Typography.caption, color: Colors.textTertiary },
  statValue: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.xs },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.md },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyText: { ...Typography.body2, color: Colors.textTertiary },
});
