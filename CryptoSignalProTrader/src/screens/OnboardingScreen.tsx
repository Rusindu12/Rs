import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { Button } from '../components/common/Button';

const { width } = Dimensions.get('window');

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  { emoji: '🤖', title: 'AI-Powered Signals', desc: 'Our AI analyzes 10 technical indicators across multiple timeframes to generate high-confidence trading signals.' },
  { emoji: '🔄', title: '24/7 Background Trading', desc: 'The bot runs continuously in the background, even when your phone is locked or the app is closed.' },
  { emoji: '🛡️', title: 'Advanced Risk Management', desc: 'Dynamic stop-losses, position sizing, daily loss limits, and emergency panic button protect your capital.' },
];

export const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [agreed, setAgreed] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setCurrentPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {slides.map((slide, i) => (
          <View key={i} style={styles.slide}>
            <Text style={styles.emoji}>{slide.emoji}</Text>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideDesc}>{slide.desc}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {slides.map((_, i) => <View key={i} style={[styles.dot, i === currentPage && styles.activeDot]} />)}
      </View>
      <View style={styles.footer}>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>⚠️ Risk Disclaimer</Text>
          <ScrollView style={styles.disclaimerScroll}>
            <Text style={styles.disclaimerText}>
              Cryptocurrency trading involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. You should only trade with money you can afford to lose. This app provides tools and signals but does not guarantee profits. Always do your own research before making investment decisions.
            </Text>
          </ScrollView>
          <Button title={currentPage === slides.length - 1 ? "I Understand & Continue" : "Next"} onPress={currentPage === slides.length - 1 ? onComplete : () => {}} variant="primary" fullWidth />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  slide: { width, justifyContent: 'center', alignItems: 'center', padding: Spacing.huge },
  emoji: { fontSize: 64, marginBottom: Spacing.xxl },
  slideTitle: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  slideDesc: { ...Typography.body1, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: Spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cardHover },
  activeDot: { backgroundColor: Colors.primary, width: 24 },
  footer: { padding: Spacing.xl },
  disclaimer: { backgroundColor: Colors.card, borderRadius: 16, padding: Spacing.lg },
  disclaimerTitle: { ...Typography.h4, color: Colors.warning, marginBottom: Spacing.sm },
  disclaimerScroll: { maxHeight: 100, marginBottom: Spacing.lg },
  disclaimerText: { ...Typography.body2, color: Colors.textSecondary, lineHeight: 20 },
});
