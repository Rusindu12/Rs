import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Colors, getSignalColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useAppSelector } from '../store/store';
import { binanceRest } from '../api/binanceRest';
import { formatPairName, formatPrice, formatLargeNumber } from '../utils/priceFormatter';
import { BinanceKline } from '../types/binance';
import { Card } from '../components/common/Card';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

interface ChartProps { navigation: any; }

export const ChartScreen: React.FC<ChartProps> = ({ navigation }) => {
  const { selectedSymbol } = useAppSelector(state => state.market);
  const [timeframe, setTimeframe] = useState('1h');
  const [klines, setKlines] = useState<BinanceKline[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    loadKlines();
  }, [selectedSymbol, timeframe]);

  const loadKlines = async () => {
    try {
      const data = await binanceRest.getKlines(selectedSymbol, timeframe as any, 200);
      setKlines(data);
      if (data.length > 0) {
        const last = data[data.length - 1];
        setCurrentPrice(parseFloat(last.close));
        const first = data[0];
        setPriceChange(((parseFloat(last.close) - parseFloat(first.open)) / parseFloat(first.open)) * 100);
        setVolume(data.reduce((sum, k) => sum + parseFloat(k.volume), 0));
      }
    } catch (error) {
      console.error('Failed to load klines:', error);
    }
  };

  const chartHeight = 300;
  const chartWidth = SCREEN_WIDTH - Spacing.lg * 2;
  const maxPrice = klines.length > 0 ? Math.max(...klines.map(k => parseFloat(k.high))) : 0;
  const minPrice = klines.length > 0 ? Math.min(...klines.map(k => parseFloat(k.low))) : 0;
  const priceRange = maxPrice - minPrice;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pairName}>{formatPairName(selectedSymbol)}</Text>
        <Text style={[styles.price, { color: priceChange >= 0 ? Colors.buy : Colors.sell }]}>
          ${formatPrice(currentPrice)}
        </Text>
        <Text style={[styles.change, { color: priceChange >= 0 ? Colors.buy : Colors.sell }]}>
          {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
        </Text>
      </View>

      <View style={styles.timeframeRow}>
        {timeframes.map(tf => (
          <TouchableOpacity key={tf} onPress={() => setTimeframe(tf)}
            style={[styles.tfBtn, timeframe === tf && styles.tfBtnActive]}>
            <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>{tf}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={styles.chartCard}>
        <View style={styles.chartArea}>
          {klines.length > 0 && klines.slice(-50).map((k, i) => {
            const open = parseFloat(k.open);
            const close = parseFloat(k.close);
            const high = parseFloat(k.high);
            const low = parseFloat(k.low);
            const isBullish = close >= open;
            const candleWidth = (chartWidth - 40) / 50;
            const bodyTop = chartHeight - ((Math.max(open, close) - minPrice) / priceRange) * (chartHeight - 20);
            const bodyBottom = chartHeight - ((Math.min(open, close) - minPrice) / priceRange) * (chartHeight - 20);
            const wickTop = chartHeight - ((high - minPrice) / priceRange) * (chartHeight - 20);
            const wickBottom = chartHeight - ((low - minPrice) / priceRange) * (chartHeight - 20);
            const x = 20 + i * candleWidth;

            return (
              <View key={i} style={{ position: 'absolute', left: x, width: candleWidth - 1 }}>
                <View style={{ position: 'absolute', left: candleWidth / 2 - 0.5, top: wickTop, width: 1, height: wickBottom - wickTop, backgroundColor: isBullish ? Colors.buy : Colors.sell }} />
                <View style={{ position: 'absolute', left: 1, top: bodyTop, width: candleWidth - 3, height: Math.max(1, bodyBottom - bodyTop), backgroundColor: isBullish ? Colors.buy : Colors.sell, borderRadius: 1 }} />
              </View>
            );
          })}
        </View>
      </Card>

      <View style={styles.infoRow}>
        <Card style={styles.infoCard}>
          <Text style={styles.infoLabel}>24h Volume</Text>
          <Text style={styles.infoValue}>{formatLargeNumber(volume)}</Text>
        </Card>
        <Card style={styles.infoCard}>
          <Text style={styles.infoLabel}>High</Text>
          <Text style={styles.infoValue}>${formatPrice(maxPrice)}</Text>
        </Card>
        <Card style={styles.infoCard}>
          <Text style={styles.infoLabel}>Low</Text>
          <Text style={styles.infoValue}>${formatPrice(minPrice)}</Text>
        </Card>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  header: { marginBottom: Spacing.lg },
  pairName: { ...Typography.h2, color: Colors.textPrimary },
  price: { ...Typography.price, marginTop: Spacing.xs },
  change: { ...Typography.body2, marginTop: Spacing.xs },
  timeframeRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.lg },
  tfBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.card },
  tfBtnActive: { backgroundColor: Colors.primary },
  tfText: { ...Typography.caption, color: Colors.textSecondary },
  tfTextActive: { color: Colors.textInverse, fontWeight: '700' },
  chartCard: { marginBottom: Spacing.lg, padding: Spacing.sm },
  chartArea: { height: 300, position: 'relative' },
  infoRow: { flexDirection: 'row', gap: Spacing.sm },
  infoCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  infoLabel: { ...Typography.overline, color: Colors.textTertiary },
  infoValue: { ...Typography.mono, color: Colors.textPrimary, marginTop: 4 },
});
