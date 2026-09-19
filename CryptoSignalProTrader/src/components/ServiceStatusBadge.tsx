import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { secondsToHumanReadable } from '../utils/timeHelpers';

interface ServiceStatusBadgeProps {
  isActive: boolean;
  uptime: number;
  health: 'healthy' | 'degraded' | 'error';
}

export const ServiceStatusBadge: React.FC<ServiceStatusBadgeProps> = ({ isActive, uptime, health }) => {
  const getStatusColor = () => {
    if (!isActive) return Colors.textTertiary;
    if (health === 'error') return Colors.danger;
    if (health === 'degraded') return Colors.warning;
    return Colors.buy;
  };

  const getStatusText = () => {
    if (!isActive) return 'Stopped';
    if (health === 'error') return 'Error';
    if (health === 'degraded') return 'Degraded';
    return 'Running';
  };

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      <View>
        <Text style={[styles.status, { color: getStatusColor() }]}>{getStatusText()}</Text>
        {isActive && <Text style={styles.uptime}>Uptime: {secondsToHumanReadable(uptime)}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { ...Typography.body2, fontWeight: '600' },
  uptime: { ...Typography.caption, color: Colors.textTertiary },
});
