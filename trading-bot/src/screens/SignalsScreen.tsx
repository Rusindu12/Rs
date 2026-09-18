import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Chip, EmptyState, Screen, actionTone } from '../components/ui';
import { colors } from '../theme';
import { runtime } from '../engine/runtime';
import { useBotStore } from '../store/botStore';
import { fmtPrice } from '../utils/format';
import type { Signal } from '../engine/types';

export function SignalsScreen() {
  const signals = useBotStore((s) => s.signals);
  const ticking = useBotStore((s) => s.ticking);
  const lastTickAt = useBotStore((s) => s.lastTickAt);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await runtime.runTick();
    setRefreshing(false);
  }, []);

  if (!signals.length) {
    return (
      <Screen>
        <EmptyState
          icon="⚡"
          title="No signals yet"
          subtitle="The AI engine scores every watchlist symbol across 5 timeframes on each cycle. Press refresh to run one now."
        />
        <Button label={refreshing ? 'Analysing markets…' : '⟳ Run analysis now'} onPress={refresh} loading={refreshing} />
      </Screen>
    );
  }

  const sorted = [...signals].sort((a, b) => b.confidence - a.confidence);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>
          {signals.length} symbols · AI v2 · 1m–4h
          {lastTickAt ? ` · ${new Date(lastTickAt).toLocaleTimeString('en-US', { hour12: false })}` : ''}
        </Text>
        {ticking || refreshing ? (
          <ActivityIndicator color={colors.gold} size="small" />
        ) : (
          <Button label="⟳" tone="ghost" onPress={refresh} style={styles.refreshBtn} />
        )}
      </View>

      {sorted.map((s) => (
        <SignalCard key={s.symbol} signal={s} />
      ))}
    </Screen>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const [open, setOpen] = useState(false);
  const tone = actionTone(signal.action);
  const stripe = tone === 'buy' ? colors.green : tone === 'sell' ? colors.red : colors.gold;
  const ex = signal.extras;

  return (
    <View style={[styles.cardWrap, { borderLeftColor: stripe }]}>
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.headLeft}>
            <Text style={styles.symbol}>{signal.symbol}</Text>
            <Text style={styles.price}>{fmtPrice(signal.price)}</Text>
          </View>
          <View style={styles.headRight}>
            <Badge text={signal.action.replace('_', ' ')} tone={tone} />
            <Text style={[styles.score, { color: stripe }]}>
              {signal.score > 0 ? '+' : ''}
              {signal.score}
            </Text>
          </View>
        </View>

        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${Math.min(100, signal.confidence)}%`, backgroundColor: stripe }]} />
        </View>
        <View style={styles.confRow}>
          <Text style={styles.confText}>confidence {signal.confidence}%</Text>
          <Text style={styles.confText}>
            {ex.regime === 'trending' ? `ADX ${ex.adx} · trending` : `ADX ${ex.adx} · ranging`}
            {ex.expectedMovePct > 0 ? ` · exp. move ±${ex.expectedMovePct}%` : ''}
          </Text>
        </View>

        {/* AI v2 context chips */}
        <View style={styles.chipRow}>
          {ex.pattern ? (
            <Chip
              label="PATTERN"
              value={ex.pattern}
              tone={ex.pattern.match(/Bullish|Hammer|Morning/) ? 'buy' : ex.pattern.match(/Bearish|Shooting|Evening/) ? 'sell' : 'neutral'}
            />
          ) : null}
          {ex.divergence ? (
            <Chip label="DIVERGENCE" value={`${ex.divergence} RSI`} tone={ex.divergence === 'bullish' ? 'buy' : 'sell'} />
          ) : null}
          {ex.srBias && ex.srBias !== 'no clear S/R interaction' ? (
            <Chip label="S/R" value={ex.srBias} tone="info" />
          ) : null}
        </View>

        {open ? (
          <View style={styles.factors}>
            <Text style={styles.factorHeading}>SIGNAL BREAKDOWN</Text>
            {signal.factors.map((f, i) => (
              <View key={`${f.name}-${i}`} style={styles.factorRow}>
                <Text style={styles.factorName}>{f.name}</Text>
                <Text style={styles.factorDetail}>{f.detail}</Text>
                <Text
                  style={[styles.factorScore, { color: f.score > 0 ? colors.green : f.score < 0 ? colors.red : colors.textFaint }]}
                >
                  {f.score > 0 ? '+' : ''}
                  {f.score}
                </Text>
              </View>
            ))}
            {signal.timeframes.length ? (
              <>
                <Text style={styles.factorHeading}>TIMEFRAME SCORES (weighted)</Text>
                <View style={styles.tfRow}>
                  {signal.timeframes.map((t) => (
                    <View key={t.tf} style={styles.tfChip}>
                      <Text style={styles.tfLabel}>{t.tf}</Text>
                      <Text style={[styles.tfScore, { color: t.score > 0 ? colors.green : t.score < 0 ? colors.red : colors.textDim }]}>
                        {t.score > 0 ? '+' : ''}
                        {t.score.toFixed(0)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <Button
          label={open ? '▲ Hide breakdown' : '▼ Full breakdown'}
          tone="ghost"
          onPress={() => setOpen(!open)}
          style={styles.breakdownBtn}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerText: { color: colors.textDim, fontSize: 11.5, flex: 1, marginRight: 8 },
  refreshBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  cardWrap: {
    borderLeftWidth: 3,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  card: { marginBottom: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headLeft: { flex: 1 },
  symbol: { color: colors.text, fontSize: 16, fontWeight: '900' },
  price: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  headRight: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 15, fontWeight: '900' },
  meterTrack: {
    height: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  meterFill: { height: 6, borderRadius: 3 },
  confRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  confText: { color: colors.textFaint, fontSize: 10.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  breakdownBtn: { marginTop: 10, paddingVertical: 9 },
  factors: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  factorHeading: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 2,
  },
  factorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  factorName: { color: colors.text, fontSize: 11.5, fontWeight: '700', width: 82 },
  factorDetail: { color: colors.textDim, fontSize: 11.5, flex: 1, lineHeight: 15 },
  factorScore: { fontSize: 12, fontWeight: '800', width: 34, textAlign: 'right' },
  tfRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  tfChip: {
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tfLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  tfScore: { fontSize: 11.5, fontWeight: '800', marginTop: 1 },
});
