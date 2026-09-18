import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, CardTitle, EmptyState, Screen, Segmented, StatusDot } from '../components/ui';
import { colors } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useBotStore } from '../store/botStore';
import type { TradeRecord } from '../engine/types';
import { fmtPrice, fmtQty, fmtUsd, baseAsset } from '../utils/format';

/**
 * 💹 ACTIVITY — a dedicated, live feed of every coin the bot BUYS and SELLS.
 * Each event is one green (bought) or red (sold) card, newest first.
 */

type Filter = 'all' | 'buy' | 'sell';

interface Event {
  key: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  qty: number;
  price: number;
  at: number;
  pnlUsdt?: number;
  pnlPct?: number;
  reason: string;
  mode: 'paper' | 'live';
}

function eventsFrom(trades: TradeRecord[]): Event[] {
  const out: Event[] = [];
  for (const t of trades) {
    out.push({
      key: `${t.id}-buy`,
      type: 'BUY',
      symbol: t.symbol,
      qty: t.qty,
      price: t.entryPrice,
      at: t.openedAt,
      reason: t.reason,
      mode: t.mode,
    });
    if (t.status === 'CLOSED') {
      out.push({
        key: `${t.id}-sell`,
        type: 'SELL',
        symbol: t.symbol,
        qty: t.qty,
        price: t.exitPrice ?? 0,
        at: t.closedAt ?? t.openedAt,
        pnlUsdt: t.pnlUsdt,
        pnlPct: t.pnlPct,
        reason: t.reason,
        mode: t.mode,
      });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

const REASON_LABEL: Record<string, string> = {
  TAKE_PROFIT: '🎯 take-profit hit',
  STOP_LOSS: '🛑 stop-loss hit',
  SIGNAL_EXIT: '🔻 AI sell signal',
  SIGNAL_FLIP: '🔄 AI turned bearish',
  MAX_HOLD: '⏱ max hold time reached',
  EMERGENCY_STOP: '🚨 emergency stop',
  MANUAL: '✋ closed manually',
  SERVER_SIDE_EXIT: '🛰️ sold by Binance while offline',
};

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ActivityScreen() {
  const trades = useBotStore((s) => s.trades);
  const running = useBotStore((s) => s.running);
  const ticking = useBotStore((s) => s.ticking);
  const wsConnected = useAuthStore((s) => s.wsConnected);
  const simulated = useAuthStore((s) => s.simulated);
  const [filter, setFilter] = useState<Filter>('all');

  // re-render every 15s so "time ago" stays fresh
  const [, setClock] = useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setClock((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const events = useMemo(() => eventsFrom(trades), [trades]);
  const shown = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.type === (filter === 'buy' ? 'BUY' : 'SELL'))),
    [events, filter]
  );

  const dayAgo = Date.now() - 86_400_000;
  const buys24 = events.filter((e) => e.type === 'BUY' && e.at >= dayAgo).length;
  const sells24 = events.filter((e) => e.type === 'SELL' && e.at >= dayAgo).length;
  const sold24 = events.filter((e) => e.type === 'SELL' && e.at >= dayAgo);
  const pnl24 = sold24.reduce((s, e) => s + (e.pnlUsdt ?? 0), 0);

  return (
    <Screen>
      {/* live status header */}
      <Card>
        <CardTitle
          right={
            <View style={styles.liveWrap}>
              <StatusDot ok={wsConnected} />
              <Text style={[styles.liveText, { color: wsConnected ? colors.green : colors.red }]}>
                {wsConnected ? 'LIVE' : 'OFFLINE'}
              </Text>
              {ticking && <View style={styles.scanningDot} />}
              <Text style={styles.scanningText}>
                {simulated ? 'SIMULATED PRICES' : ticking ? 'scanning…' : running ? 'waiting next cycle' : 'bot idle'}
              </Text>
            </View>
          }
        >
          💹 BUY / SELL ACTIVITY
        </CardTitle>
        <View style={styles.sumRow}>
          <View style={[styles.sumCell, { borderColor: colors.greenDim }]}>
            <Text style={[styles.sumNum, { color: colors.green }]}>{buys24}</Text>
            <Text style={styles.sumLabel}>buys · 24h</Text>
          </View>
          <View style={[styles.sumCell, { borderColor: colors.redDim }]}>
            <Text style={[styles.sumNum, { color: colors.red }]}>{sells24}</Text>
            <Text style={styles.sumLabel}>sells · 24h</Text>
          </View>
          <View style={[styles.sumCell, { borderColor: pnl24 >= 0 ? colors.greenDim : colors.redDim }]}>
            <Text style={[styles.sumNum, { color: pnl24 >= 0 ? colors.green : colors.red }]}>
              {fmtUsd(pnl24, { sign: true })}
            </Text>
            <Text style={styles.sumLabel}>sold PnL · 24h</Text>
          </View>
        </View>
        <Segmented
          options={[
            { value: 'all' as const, label: `All (${events.length})` },
            { value: 'buy' as const, label: `Buys (${events.filter((e) => e.type === 'BUY').length})` },
            { value: 'sell' as const, label: `Sells (${events.filter((e) => e.type === 'SELL').length})` },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </Card>

      {/* the feed */}
      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon="💱"
            title="No trades here yet"
            subtitle={
              running
                ? 'The bot is scanning the market right now. The moment it buys or sells a coin, it pops up here instantly.'
                : 'The bot is not running. In demo mode it starts automatically; with keys, press ▶ Start on the Dashboard.'
            }
          />
        </Card>
      ) : (
        shown.map((e) => {
          const isBuy = e.type === 'BUY';
          return (
            <View key={e.key} style={[styles.event, { borderLeftColor: isBuy ? colors.green : colors.red }]}>
              <View style={[styles.iconWrap, { backgroundColor: isBuy ? colors.greenDim : colors.redDim }]}>
                <Text style={styles.icon}>{isBuy ? '▲' : '▼'}</Text>
              </View>
              <View style={styles.mid}>
                <View style={styles.line1}>
                  <Text style={[styles.verb, { color: isBuy ? colors.green : colors.red }]}>{isBuy ? 'BOUGHT' : 'SOLD'}</Text>
                  <Text style={styles.sym}>{baseAsset(e.symbol)}</Text>
                  {e.mode === 'paper' && <Badge text="DEMO" tone="gold" small />}
                </View>
                <Text style={styles.detail}>
                  {fmtQty(e.qty)} {baseAsset(e.symbol)} @ {fmtPrice(e.price)}
                </Text>
                <Text style={styles.reason} numberOfLines={1}>
                  {REASON_LABEL[e.reason] ?? e.reason}
                </Text>
              </View>
              <View style={styles.right}>
                {isBuy ? (
                  <Badge text="holding" tone="info" small />
                ) : (
                  <Text style={[styles.pnl, { color: (e.pnlUsdt ?? 0) >= 0 ? colors.green : colors.red }]}>
                    {fmtUsd(e.pnlUsdt, { sign: true })}
                    {e.pnlPct != null ? `\n${e.pnlPct >= 0 ? '+' : ''}${e.pnlPct.toFixed(2)}%` : ''}
                  </Text>
                )}
                <Text style={styles.time}>{timeAgo(e.at)}</Text>
              </View>
            </View>
          );
        })
      )}

      <Text style={styles.footer}>
        Every buy & sell appears here instantly · every BUY is eventually SOLD: 🎯 take-profit · 🛑 stop-loss · 🔄 AI turns bearish · ⏱ max hold
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveText: { fontSize: 10, fontWeight: '800' },
  scanningDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold, marginLeft: 4 },
  scanningText: { color: colors.textFaint, fontSize: 10 },
  sumRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  sumCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
  },
  sumNum: { fontSize: 16, fontWeight: '800' },
  sumLabel: { color: colors.textDim, fontSize: 9, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    marginBottom: 8,
  },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 15, fontWeight: '900' },
  mid: { flex: 1, gap: 2 },
  line1: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verb: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  sym: { color: colors.text, fontSize: 14, fontWeight: '800' },
  detail: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  reason: { color: colors.textFaint, fontSize: 10 },
  right: { alignItems: 'flex-end', gap: 3 },
  pnl: { color: colors.green, fontSize: 12, fontWeight: '800', textAlign: 'right', lineHeight: 15 },
  time: { color: colors.textFaint, fontSize: 9 },
  footer: { color: colors.textFaint, fontSize: 10, textAlign: 'center', paddingVertical: 14, paddingHorizontal: 8 },
});
