import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Colors, getSignalColor } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Slider } from '../components/common/Slider';
import { Toggle } from '../components/common/Toggle';
import { useAppSelector } from '../store/store';
import { formatPairName, formatPrice } from '../utils/priceFormatter';

interface TradingProps { navigation: any; route: any; }

export const TradingScreen: React.FC<TradingProps> = ({ navigation, route }) => {
  const signal = route?.params?.signal;
  const { settings } = useAppSelector(state => state.settings);
  const { portfolioValue } = useAppSelector(state => state.trades);
  const [symbol, setSymbol] = useState(signal?.symbol || 'BTCUSDT');
  const [side, setSide] = useState<'BUY' | 'SELL'>(signal?.signalType?.includes('BUY') ? 'BUY' : 'SELL');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState('0');
  const [price, setPrice] = useState(signal?.priceAtSignal?.toString() || '0');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [useTrailing, setUseTrailing] = useState(false);
  const [percentOfBalance, setPercentOfBalance] = useState(settings.maxTradePct);

  const estimatedTotal = parseFloat(quantity || '0') * parseFloat(price || '0');
  const estimatedFee = estimatedTotal * 0.001;

  const handleTrade = () => {
    Alert.alert(
      'Confirm Trade',
      `${side} ${formatPairName(symbol)}\nQty: ${quantity}\nPrice: $${price}\nTotal: $${estimatedTotal.toFixed(2)}\nFee: $${estimatedFee.toFixed(2)}\nMode: ${settings.isPaperTrade ? 'Paper' : 'LIVE'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => Alert.alert('✅ Trade Executed', 'Your order has been placed.') },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Trade {formatPairName(symbol)}</Text>

        <View style={styles.sideToggle}>
          <Button title="BUY" onPress={() => setSide('BUY')} variant={side === 'BUY' ? 'buy' : 'ghost'} style={{ flex: 1 }} />
          <Button title="SELL" onPress={() => setSide('SELL')} variant={side === 'SELL' ? 'sell' : 'ghost'} style={{ flex: 1 }} />
        </View>

        <View style={styles.typeToggle}>
          <Button title="Market" onPress={() => setOrderType('MARKET')} variant={orderType === 'MARKET' ? 'primary' : 'ghost'} size="small" />
          <Button title="Limit" onPress={() => setOrderType('LIMIT')} variant={orderType === 'LIMIT' ? 'primary' : 'ghost'} size="small" />
        </View>

        {signal && (
          <Card style={styles.signalCard}>
            <Text style={styles.signalLabel}>Signal</Text>
            <Text style={[styles.signalType, { color: getSignalColor(signal.signalType) }]}>{signal.signalType.replace('_', ' ')}</Text>
            <Text style={styles.signalConf}>Confidence: {signal.confidence.toFixed(0)}%</Text>
          </Card>
        )}

        <Slider label={`Quantity (% of balance)`} value={percentOfBalance} onValueChange={(v) => {
          setPercentOfBalance(v);
          const amount = portfolioValue * (v / 100);
          const qty = parseFloat(price) > 0 ? (amount / parseFloat(price)).toFixed(6) : '0';
          setQuantity(qty);
        }} minimumValue={1} maximumValue={100} suffix="%" />

        <Input label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="0.00" />
        {orderType === 'LIMIT' && <Input label="Price" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" />}
        <Input label="Stop Loss (optional)" value={stopLoss} onChangeText={setStopLoss} keyboardType="numeric" placeholder="0.00" />
        <Input label="Take Profit (optional)" value={takeProfit} onChangeText={setTakeProfit} keyboardType="numeric" placeholder="0.00" />

        <View style={styles.trailingRow}>
          <Text style={styles.trailingLabel}>Trailing Stop</Text>
          <Toggle value={useTrailing} onValueChange={setUseTrailing} />
        </View>

        <Card style={styles.preview}>
          <Text style={styles.previewTitle}>Order Preview</Text>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Total Value</Text>
            <Text style={styles.previewValue}>${estimatedTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Est. Fee (0.1%)</Text>
            <Text style={styles.previewValue}>${estimatedFee.toFixed(2)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Mode</Text>
            <Text style={[styles.previewValue, { color: settings.isPaperTrade ? Colors.warning : Colors.danger }]}>
              {settings.isPaperTrade ? '📝 Paper' : '🔴 LIVE'}
            </Text>
          </View>
        </Card>

        <Button title={`${side} ${formatPairName(symbol)}`} onPress={handleTrade}
          variant={side === 'BUY' ? 'buy' : 'sell'} fullWidth size="large" />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.xl },
  sideToggle: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  typeToggle: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  signalCard: { marginBottom: Spacing.lg, alignItems: 'center' },
  signalLabel: { ...Typography.caption, color: Colors.textTertiary },
  signalType: { ...Typography.h3, marginTop: Spacing.xs },
  signalConf: { ...Typography.body2, color: Colors.textSecondary, marginTop: Spacing.xs },
  trailingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  trailingLabel: { ...Typography.body1, color: Colors.textPrimary },
  preview: { marginBottom: Spacing.xl },
  previewTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.md },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  previewLabel: { ...Typography.body2, color: Colors.textSecondary },
  previewValue: { ...Typography.mono, color: Colors.textPrimary },
});
