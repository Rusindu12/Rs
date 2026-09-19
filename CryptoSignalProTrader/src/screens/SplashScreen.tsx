import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
      Animated.timing(textFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(onFinish, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Animated.Text style={[styles.logo, { transform: [{ scale: pulseAnim }] }]}>🤖</Animated.Text>
      </Animated.View>
      <Animated.View style={[styles.textContainer, { opacity: textFade }]}>
        <Text style={styles.title}>CryptoSignal AI</Text>
        <Text style={styles.subtitle}>Pro Trader</Text>
        <Text style={styles.version}>v1.0.0</Text>
        <View style={styles.loadingBar}>
          <View style={styles.loadingFill} />
        </View>
        <Text style={styles.loadingText}>AI Engine Initializing...</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  logoContainer: { marginBottom: 40 },
  logo: { fontSize: 80 },
  textContainer: { alignItems: 'center' },
  title: { ...Typography.h1, color: Colors.primary, letterSpacing: 2 },
  subtitle: { ...Typography.h2, color: Colors.textPrimary, marginTop: 4 },
  version: { ...Typography.caption, color: Colors.textTertiary, marginTop: 8 },
  loadingBar: { width: 200, height: 3, backgroundColor: Colors.cardHover, borderRadius: 2, marginTop: 32, overflow: 'hidden' },
  loadingFill: { width: '70%', height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  loadingText: { ...Typography.body2, color: Colors.textSecondary, marginTop: 12 },
});
