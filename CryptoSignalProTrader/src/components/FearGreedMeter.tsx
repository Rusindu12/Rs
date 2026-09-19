import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';

interface FearGreedMeterProps {
  value: number;
  label: string;
}

export const FearGreedMeter: React.FC<FearGreedMeterProps> = ({ value, label }) => {
  const getColor = () => {
    if (value <= 25) return Colors.danger;
    if (value <= 45) return Colors.warning;
    if (value <= 55) return Colors.textSecondary;
    if (value <= 75) return Colors.buy;
    return Colors.buy;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fear & Greed Index</Text>
      <View style={styles.gaugeContainer}>
        <View style={styles.gauge}>
          <View style={[styles.gaugeFill, { width: `${value}%`, backgroundColor: getColor() }]} />
        </View>
        <Text style={[styles.value, { color: getColor() }]}>{value}</Text>
      </View>
      <Text style={[styles.label, { color: getColor() }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  title: { ...Typography.caption, color: Colors.textTertiary, marginBottom: Spacing.sm },
  gaugeContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  gauge: { flex: 1, height: 8, backgroundColor: Colors.cardHover, borderRadius: 4, overflow: 'hidden' },
  gaugeFill: { height: 8, borderRadius: 4 },
  value: { ...Typography.h3 },
  label: { ...Typography.body2, marginTop: Spacing.xs },
});
