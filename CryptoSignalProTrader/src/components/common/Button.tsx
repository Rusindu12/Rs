import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'buy' | 'sell' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title, onPress, variant = 'primary', size = 'medium',
  disabled = false, loading = false, icon, style, textStyle, fullWidth = false,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return Colors.cardHover;
    switch (variant) {
      case 'primary': return Colors.primary;
      case 'buy': return Colors.buy;
      case 'sell': return Colors.sell;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return Colors.textTertiary;
    switch (variant) {
      case 'primary': return Colors.textInverse;
      case 'buy': return Colors.textInverse;
      case 'sell': return Colors.textInverse;
      case 'outline': return Colors.primary;
      case 'ghost': return Colors.textPrimary;
      default: return Colors.textInverse;
    }
  };

  const getSize = () => {
    switch (size) {
      case 'small': return { paddingV: Spacing.sm, paddingH: Spacing.md, fontSize: 12 };
      case 'medium': return { paddingV: Spacing.md, paddingH: Spacing.xl, fontSize: 14 };
      case 'large': return { paddingV: Spacing.lg, paddingH: Spacing.xxl, fontSize: 16 };
    }
  };

  const sizeStyle = getSize();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          paddingVertical: sizeStyle.paddingV,
          paddingHorizontal: sizeStyle.paddingH,
          borderColor: variant === 'outline' ? Colors.primary : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: getTextColor(), fontSize: sizeStyle.fontSize }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  text: {
    ...Typography.button,
  },
});
