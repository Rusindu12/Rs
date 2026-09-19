import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Colors, getPnlColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useBacktest } from '../hooks/useBacktest';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatCurrency, formatPercentage } from '../utils/priceFormatter';

interface BacktestProps { navigation: any; }

export const BacktestScreen: React.FC<BacktestProps> = ({ navigation }) => {
  const { results, currentResult, isRunning, progress, startBacktest } = useBacktest();
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [capital, setCapital] = useState('10000');

  const handleRun = async () => {
    await startBacktest({
      symbol, timeframe: timeframe as any, startDate, endDate,
      initialCapital: parseFloat(capital), strategy: 'moderate',
      maxTradePct: 3, stopLossPct: 2, takeProfitPct: 4, minConfidence: 65,
    });
  };

  const r = currentResult;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Backtesting</Text>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Configuration</Text>
          <Input label="Symbol" value={symbol} onChangeText={setSymbol} />
          <View style={styles.tfRow}>
            {['5m', '15m', '1h', '4h', '1d'].map(tf => (
              <Button key={tf} title={tf} onPress={() => setTimeframe(tf)} variant={timeframe === tf ? 'primary' : 'ghost'} size="small" />
            ))}
          </View>
          <Input label="Start Date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          <Input label="End Date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
          <Input label="Initial Capital ($)" value={capital} onChangeText={setCapital} keyboardType="numeric" />
          <Button title={isRunning ? `Running... ${progress.toFixed(0)}%` : 'Run Backtest'} onPress={handleRun} variant="primary" fullWidth loading={isRunning} />
        </Card>

        {r && (
          <>
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Results</Text>
              <View style={styles.resultGrid}>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Total Return</Text>
                  <Text style={[styles.resultValue, { color: getPnlColor(r.totalReturn) }]}>{formatPercentage(r.totalReturn)}</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Final Capital</Text>
                  <Text style={styles.resultValue}>{formatCurrency(r.finalCapital)}</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Win Rate</Text>
                  <Text style={[styles.resultValue, { color: Colors.buy }]}>{r.winRate.toFixed(1)}%</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Sharpe Ratio</Text>
                  <Text style={styles.resultValue}>{r.sharpeRatio.toFixed(2)}</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Max Drawdown</Text>
                  <Text style={[styles.resultValue, { color: Colors.danger }]}>-{(r.maxDrawdown * 100).toFixed(2)}%</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Profit Factor</Text>
                  <Text style={styles.resultValue}>{r.profitFactor.toFixed(2)}</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Total Trades</Text>
                  <Text style={styles.resultValue}>{r.totalTrades}</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Avg Win</Text>
                  <Text style={[styles.resultValue, { color: Colors.buy }]}>${r.avgWin.toFixed(2)}</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Avg Loss</Text>
                  <Text style={[styles.resultValue, { color: Colors.sell }]}>-${Math.abs(r.avgLoss).toFixed(2)}</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Max Win Streak</Text>
                  <Text style={styles.resultValue}>{r.maxConsecutiveWins}</Text>
                </View>
              </View>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Equity Curve</Text>
              <View style={styles.chartArea}>
                {r.equityCurve.length > 0 && (() => {
                  const maxEquity = Math.max(...r.equityCurve.map(e => e.equity));
                  const minEquity = Math.min(...r.equityCurve.map(e => e.equity));
                  const range = maxEquity - minEquity || 1;
                  const step = Math.max(1, Math.floor(r.equityCurve.length / 100));
                  return r.equityCurve.filter((_, i) => i % step === 0).map((point, i, arr) => {
                    const chartW = Dimensions.get('window').width - Spacing.lg * 4;
                    const chartH = 150;
                    const x = (i / arr.length) * chartW;
                    const y = chartH - ((point.equity - minEquity) / range) * chartH;
                    return (
                      <View key={i} style={{ position: 'absolute', left: x, top: y, width: 3, height: 3, borderRadius: 1.5, backgroundColor: point.equity >= r.initialCapital ? Colors.buy : Colors.sell }} />
                    );
                  });
                })()}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.xl },
  card: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h4, color: Colors.primary, marginBottom: Spacing.md },
  tfRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  resultItem: { width: '50%', paddingVertical: Spacing.sm },
  resultLabel: { ...Typography.overline, color: Colors.textTertiary },
  resultValue: { ...Typography.h4, color: Colors.textPrimary, marginTop: Spacing.xs },
  chartArea: { height: 150, position: 'relative', backgroundColor: Colors.cardDark, borderRadius: BorderRadius.md },
});
