import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Colors, getPnlColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useAppSelector } from '../store/store';
import { formatPnl } from '../utils/priceFormatter';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { TradeCard } from '../components/TradeCard';

interface TradeHistoryProps { navigation: any; }

export const TradeHistoryScreen: React.FC<TradeHistoryProps> = ({ navigation }) => {
  const { closedTrades, stats } = useAppSelector(state => state.trades);
  const [filter, setFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');

  const filtered = filter === 'ALL' ? closedTrades :
    filter === 'WIN' ? closedTrades.filter(t => (t.netPnl || 0) > 0) :
    closedTrades.filter(t => (t.netPnl || 0) <= 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trade History</Text>

      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{stats?.totalTrades || 0}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Win Rate</Text>
            <Text style={[styles.statValue, { color: Colors.buy }]}>{(stats?.winRate || 0).toFixed(1)}%</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Net PnL</Text>
            <Text style={[styles.statValue, { color: getPnlColor(stats?.netPnl || 0) }]}>{formatPnl(stats?.netPnl || 0)}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.filters}>
        <Button title="All" onPress={() => setFilter('ALL')} variant={filter === 'ALL' ? 'primary' : 'ghost'} size="small" />
        <Button title="Wins" onPress={() => setFilter('WIN')} variant={filter === 'WIN' ? 'buy' : 'ghost'} size="small" />
        <Button title="Losses" onPress={() => setFilter('LOSS')} variant={filter === 'LOSS' ? 'sell' : 'ghost'} size="small" />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <TradeCard trade={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No trades found</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.lg },
  statsCard: { marginBottom: Spacing.lg },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statLabel: { ...Typography.overline, color: Colors.textTertiary },
  statValue: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.xs },
  filters: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  list: { paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { ...Typography.body2, color: Colors.textTertiary },
});
