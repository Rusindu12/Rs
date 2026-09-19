import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { useAppSelector } from '../store/store';
import { SignalCard } from '../components/SignalCard';
import { Button } from '../components/common/Button';

interface SignalsProps { navigation: any; }

export const SignalsScreen: React.FC<SignalsProps> = ({ navigation }) => {
  const { signals, isScanning } = useAppSelector(state => state.signals);
  const [filter, setFilter] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const filters = ['ALL', 'BUY', 'SELL', 'HOLD'];

  const filteredSignals = filter === 'ALL' ? signals : signals.filter(s =>
    filter === 'BUY' ? ['STRONG_BUY', 'BUY', 'WEAK_BUY'].includes(s.signalType) :
    filter === 'SELL' ? ['STRONG_SELL', 'SELL', 'WEAK_SELL'].includes(s.signalType) :
    s.signalType === 'HOLD'
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Signals</Text>
        {isScanning && <Text style={styles.scanning}>Scanning...</Text>}
      </View>

      <View style={styles.filters}>
        {filters.map(f => (
          <Button key={f} title={f} onPress={() => setFilter(f)} size="small"
            variant={filter === f ? 'primary' : 'ghost'} />
        ))}
      </View>

      <FlatList
        data={filteredSignals}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item }) => (
          <SignalCard signal={item} onPress={() => {}}
            onTrade={() => navigation.navigate('Trading', { signal: item })} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📡</Text>
            <Text style={styles.emptyText}>No signals found</Text>
            <Text style={styles.emptySubtext}>Start the bot to begin scanning for signals</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  title: { ...Typography.h2, color: Colors.textPrimary },
  scanning: { ...Typography.caption, color: Colors.primary },
  filters: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.lg },
  emptyText: { ...Typography.h4, color: Colors.textPrimary },
  emptySubtext: { ...Typography.body2, color: Colors.textTertiary, marginTop: Spacing.sm },
});
