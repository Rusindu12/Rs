import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, getPnlColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { formatPairName, formatPrice, formatPnl, formatDuration } from '../utils/priceFormatter';
import { Trade } from '../types/trading';

interface TradeCardProps {
  trade: Trade;
  currentPrice?: number;
  onPress?: () => void;
  onClose?: () => void;
}

export const TradeCard: React.FC<TradeCardProps> = ({ trade, currentPrice, onPress, onClose }) => {
  const price = currentPrice || trade.exitPrice || trade.entryPrice;
  const unrealizedPnl = trade.side === 'BUY'
    ? (price - trade.entryPrice) * trade.quantity
    : (trade.entryPrice - price) * trade.quantity;
  const pnl = trade.status === 'CLOSED' ? (trade.netPnl || 0) : unrealizedPnl;
  const pnlPct = trade.status === 'CLOSED'
    ? (trade.pnlPercentage || 0)
    : ((price - trade.entryPrice) / trade.entryPrice * 100) * (trade.side === 'BUY' ? 1 : -1);
  const pnlColor = getPnlColor(pnl);
  const duration = trade.durationSeconds || Math.floor((Date.now() - new Date(trade.openedAt).getTime()) / 1000);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <View style={styles.header}>
        <View>
          <View style={styles.pairRow}>
            <View style={[styles.sideIndicator, { backgroundColor: trade.side === 'BUY' ? Colors.buy : Colors.sell }]} />
            <Text style={styles.pairName}>{formatPairName(trade.symbol)}</Text>
            <View style={[styles.sideBadge, { backgroundColor: trade.side === 'BUY' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)' }]}>
              <Text style={[styles.sideText, { color: trade.side === 'BUY' ? Colors.buy : Colors.sell }]}>{trade.side}</Text>
            </View>
          </View>
          <Text style={styles.timestamp}>
            {trade.isPaperTrade ? '📝 Paper' : '🔴 Live'} • {formatDuration(duration)}
          </Text>
        </View>
        <View style={styles.pnlContainer}>
          <Text style={[styles.pnlValue, { color: pnlColor }]}>{formatPnl(pnl)}</Text>
          <Text style={[styles.pnlPercent, { color: pnlColor }]}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Entry</Text>
          <Text style={styles.detailValue}>${formatPrice(trade.entryPrice)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{trade.status === 'CLOSED' ? 'Exit' : 'Current'}</Text>
          <Text style={styles.detailValue}>${formatPrice(price)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>SL</Text>
          <Text style={[styles.detailValue, { color: Colors.sell }]}>${formatPrice(trade.stopLoss)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>TP</Text>
          <Text style={[styles.detailValue, { color: Colors.buy }]}>${formatPrice(trade.takeProfit)}</Text>
        </View>
      </View>

      {trade.status === 'OPEN' && onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close Position</Text>
        </TouchableOpacity>
      )}

      {trade.status === 'CLOSED' && trade.exitReason && (
        <View style={styles.exitReason}>
          <Text style={styles.exitReasonText}>Exit: {trade.exitReason}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sideIndicator: { width: 3, height: 20, borderRadius: 2 },
  pairName: { ...Typography.h4, color: Colors.textPrimary },
  sideBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  sideText: { ...Typography.badge },
  timestamp: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  pnlContainer: { alignItems: 'flex-end' },
  pnlValue: { ...Typography.h4 },
  pnlPercent: { ...Typography.caption, marginTop: 2 },
  details: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  detailItem: { alignItems: 'center' },
  detailLabel: { ...Typography.overline, color: Colors.textTertiary },
  detailValue: { ...Typography.monoSmall, color: Colors.textPrimary, marginTop: 2 },
  closeButton: { marginTop: Spacing.md, backgroundColor: Colors.sell, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center' },
  closeButtonText: { ...Typography.button, color: Colors.textInverse },
  exitReason: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  exitReasonText: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center' },
});
