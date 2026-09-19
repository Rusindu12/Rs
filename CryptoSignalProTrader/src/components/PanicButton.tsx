import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { BorderRadius, Spacing, Shadow } from '../theme/spacing';

interface PanicButtonProps {
  onPress: () => Promise<void>;
  disabled?: boolean;
}

export const PanicButton: React.FC<PanicButtonProps> = ({ onPress, disabled = false }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = () => {
    Alert.alert(
      '🚨 PANIC CLOSE ALL',
      'This will IMMEDIATELY close ALL open positions and cancel ALL orders. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CLOSE EVERYTHING',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await onPress();
            } catch (error) {
              Alert.alert('Error', 'Failed to close all positions');
            }
            setIsLoading(false);
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      style={[styles.button, disabled && styles.disabled]}
    >
      {isLoading ? (
        <ActivityIndicator color={Colors.textInverse} />
      ) : (
        <>
          <Text style={styles.emoji}>🚨</Text>
          <Text style={styles.text}>PANIC CLOSE ALL</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    ...Shadow.large,
  },
  disabled: { opacity: 0.5 },
  emoji: { fontSize: 24 },
  text: { ...Typography.button, color: Colors.textInverse, fontSize: 16 },
});
