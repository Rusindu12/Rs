import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, getSignalColor, getSignalBgColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { BorderRadius, Spacing, Shadow } from '../theme/spacing';
import { formatPairName, formatPrice, formatPercentage, formatTimeAgo } from '../utils/priceFormatter';
import { Signal } from '../types/signals';

interface SignalCardProps {
  signal: Signal;
  onPress?: () => void;
  onTrade?: () => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onPress, onTrade }) => {
  const signalColor = getSignalColor(signal.signalType);
  const signalBg = getSignalBgColor(signal.signalType);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pairName}>{formatPairName(signal.symbol)}</Text>
          <Text style={styles.timeframe}>{signal.timeframe} • {formatTimeAgo(signal.createdAt)}</Text>
        </View>
        <View style={[styles.signalBadge, { backgroundColor: signalBg }]}>
          <Text style={[styles.signalText, { color: signalColor }]}>
            {signal.signalType.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>${formatPrice(signal.priceAtSignal)}</Text>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Score</Text>
            <Text style={[styles.metricValue, { color: signalColor }]}>{signal.score.toFixed(0)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Confidence</Text>
            <Text style={[styles.metricValue, { color: Colors.primary }]}>{signal.confidence.toFixed(0)}%</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Regime</Text>
            <Text style={styles.metricValue}>{signal.marketRegime}</Text>
          </View>
        </View>
      </View>

      <View style={styles.indicators}>
        <View style={styles.indicatorDot}>
          <Text style={styles.indicatorLabel}>RSI</Text>
          <Text style={styles.indicatorValue}>{signal.rsiValue.toFixed(0)}</Text>
        </View>
        <View style={styles.indicatorDot}>
          <Text style={styles.indicatorLabel}>MACD</Text>
          <Text style={styles.indicatorValue}>{signal.macdHistogram > 0 ? '↑' : '↓'}</Text>
        </View>
        <View style={styles.indicatorDot}>
          <Text style={styles.indicatorLabel}>Vol</Text>
          <Text style={styles.indicatorValue}>{signal.volumeRatio.toFixed(1)}x</Text>
        </View>
        <View style={styles.indicatorDot}>
          <Text style={styles.indicatorLabel}>ADX</Text>
          <Text style={styles.indicatorValue}>{signal.adxValue.toFixed(0)}</Text>
        </View>
      </View>

      {onTrade && (
        <TouchableOpacity onPress={onTrade} style={[styles.tradeButton, { backgroundColor: signalColor }]}>
          <Text style={styles.tradeButtonText}>Trade Now</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.small },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  pairName: { ...Typography.h4, color: Colors.textPrimary },
  timeframe: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  signalBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round },
  signalText: { ...Typography.badge },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  price: { ...Typography.priceSmall, color: Colors.textPrimary },
  metrics: { flexDirection: 'row', gap: Spacing.lg },
  metric: { alignItems: 'center' },
  metricLabel: { ...Typography.overline, color: Colors.textTertiary },
  metricValue: { ...Typography.mono, color: Colors.textPrimary, marginTop: 2 },
  indicators: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  indicatorDot: { alignItems: 'center' },
  indicatorLabel: { ...Typography.overline, color: Colors.textTertiary },
  indicatorValue: { ...Typography.monoSmall, color: Colors.textSecondary, marginTop: 2 },
  tradeButton: { marginTop: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center' },
  tradeButtonText: { ...Typography.button, color: Colors.textInverse },
});
