import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  suffix?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value, onValueChange, minimumValue, maximumValue, step = 1,
  label, showValue = true, suffix = '',
}) => {
  const percent = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;

  const presetButtons = [
    { label: '25%', value: minimumValue + (maximumValue - minimumValue) * 0.25 },
    { label: '50%', value: minimumValue + (maximumValue - minimumValue) * 0.5 },
    { label: '75%', value: minimumValue + (maximumValue - minimumValue) * 0.75 },
    { label: '100%', value: maximumValue },
  ];

  return (
    <View style={styles.container}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showValue && <Text style={styles.value}>{value.toFixed(step < 1 ? 2 : 0)}{suffix}</Text>}
        </View>
      )}
      <View style={styles.trackContainer}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
          <View style={[styles.thumb, { left: `${percent}%` }]} />
        </View>
      </View>
      <View style={styles.presets}>
        {presetButtons.map(preset => (
          <Text
            key={preset.label}
            style={[styles.preset, Math.abs(value - preset.value) < step && styles.activePreset]}
            onPress={() => onValueChange(Math.round(preset.value / step) * step)}
          >
            {preset.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  label: { ...Typography.body2, color: Colors.textSecondary },
  value: { ...Typography.mono, color: Colors.primary },
  trackContainer: { paddingVertical: Spacing.sm },
  track: { height: 4, backgroundColor: Colors.cardHover, borderRadius: 2, position: 'relative' },
  fill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2, position: 'absolute' },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, position: 'absolute', top: -8, marginLeft: -10 },
  presets: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  preset: { ...Typography.caption, color: Colors.textTertiary, padding: Spacing.xs },
  activePreset: { color: Colors.primary },
});
