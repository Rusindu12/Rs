import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, getSignalColor, getSignalBgColor } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'signal' | 'pnl' | 'status';
  signal?: string;
  value?: number;
  size?: 'small' | 'medium';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', signal, value, size = 'medium' }) => {
  const getBgColor = () => {
    if (variant === 'signal' && signal) return getSignalBgColor(signal);
    if (variant === 'pnl' && value !== undefined) return value >= 0 ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)';
    if (variant === 'status') {
      if (label === 'Active') return 'rgba(14,203,129,0.15)';
      if (label === 'Error') return 'rgba(246,70,93,0.15)';
      return 'rgba(248,166,19,0.15)';
    }
    return 'rgba(240,185,11,0.15)';
  };

  const getTextColor = () => {
    if (variant === 'signal' && signal) return getSignalColor(signal);
    if (variant === 'pnl' && value !== undefined) return value >= 0 ? Colors.buy : Colors.sell;
    if (variant === 'status') {
      if (label === 'Active') return Colors.buy;
      if (label === 'Error') return Colors.sell;
      return Colors.warning;
    }
    return Colors.primary;
  };

  return (
    <View style={[styles.badge, { backgroundColor: getBgColor() }, size === 'small' && styles.small]}>
      <Text style={[styles.text, { color: getTextColor() }, size === 'small' && styles.smallText]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.round,
    alignSelf: 'flex-start',
  },
  small: { paddingHorizontal: Spacing.xs, paddingVertical: 1 },
  text: { ...Typography.badge },
  smallText: { fontSize: 8 },
});
