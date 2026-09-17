import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, CardTitle, EmptyState, Row, Screen, Segmented } from '../components/ui';
import { colors } from '../theme';
import { useBotStore } from '../store/botStore';
import { useMarketStore } from '../store/marketStore';
import { fmtPct, fmtPrice, fmtTime, fmtUsd, baseAsset } from '../utils/format';

type Tab = 'positions' | 'history' | 'log';

export function TradesScreen() {
  const positions = useBotStore((s) => s.positions);
  const trades = useBotStore((s) => s.trades);
  const logs = useBotStore((s) => s.logs);
  const tickers = useMarketStore((s) => s.tickers);
  const [tab, setTab] = useState<Tab>('positions');

  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.status === 'CLOSED');
    const wins = closed.filter((t) => (t.pnlUsdt ?? 0) > 0).length;
    return {
      total: closed.length,
      winRate: closed.length ? (wins / closed.length) * 100 : 0,
      pnl: closed.reduce((s, t) => s + (t.pnlUsdt ?? 0), 0),
    };
  }, [trades]);

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'positions' as Tab, label: `Positions (${positions.length})` },
          { value: 'history' as Tab, label: 'History' },
          { value: 'log' as Tab, label: 'Engine log' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View style={{ height: 12 }} />

      {tab === 'positions' ? (
        positions.length ? (
          positions.map((p) => {
            const price = tickers[p.symbol]?.price ?? p.entryPrice;
            const pnl = (price - p.entryPrice) * p.qty;
            const pnlPct = (pnl / (p.entryPrice * p.qty)) * 100;
            return (
              <Card key={p.id}>
                <View style={styles.posHead}>
                  <View>
                    <Text style={styles.symbol}>{p.symbol}</Text>
                    <Text style={styles.mode}>{p.mode.toUpperCase()} · LONG</Text>
                  </View>
                  <Badge text={`${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`} tone={pnl >= 0 ? 'buy' : 'sell'} />
                </View>
                <Row left="Entry" right={fmtPrice(p.entryPrice)} />
                <Row left="Mark" right={fmtPrice(price)} />
                <Row left="Quantity" right={`${p.qty.toPrecision(6)} ${baseAsset(p.symbol)}`} />
                <Row
                  left="SL / TP"
                  right={`${fmtPrice(p.stopLoss)} / ${fmtPrice(p.takeProfit)}`}
                />
                <Row
                  left="Unrealized PnL"
                  right={`${fmtUsd(pnl, { sign: true })} (${fmtPct(pnlPct)})`}
                  rightStyle={{ color: pnl >= 0 ? colors.green : colors.red, fontWeight: '800' }}
                />
                <Row left="Opened" right={fmtTime(p.openedAt)} leftStyle={{ color: colors.textFaint }} />
                <Row left="Entry signal" right={p.signalAtEntry} leftStyle={{ color: colors.textFaint }} />
              </Card>
            );
          })
        ) : (
          <EmptyState icon="📭" title="No open positions" subtitle="The bot opens trades when the AI engine fires a signal at or above your configured strength." />
        )
      ) : null}

      {tab === 'history' ? (
        <>
          <Card>
            <CardTitle>PERFORMANCE</CardTitle>
            <Row left="Closed trades" right={`${stats.total}`} />
            <Row left="Win rate" right={`${stats.winRate.toFixed(1)}%`} />
            <Row
              left="Total realized PnL"
              right={fmtUsd(stats.pnl, { sign: true })}
              rightStyle={{ color: stats.pnl >= 0 ? colors.green : colors.red, fontWeight: '800' }}
            />
          </Card>
          {trades.length ? (
            [...trades].reverse().map((t) => (
              <Card key={`${t.id}-${t.status}`}>
                <View style={styles.posHead}>
                  <View>
                    <Text style={styles.symbol}>
                      {t.symbol} <Text style={styles.side}>{t.side}</Text>
                    </Text>
                    <Text style={styles.mode}>
                      {t.mode.toUpperCase()} · {t.status === 'OPEN' ? 'OPEN' : `closed ${t.closedAt ? fmtTime(t.closedAt) : ''}`}
                    </Text>
                  </View>
                  {t.status === 'CLOSED' && t.pnlUsdt != null ? (
                    <Badge text={fmtUsd(t.pnlUsdt, { sign: true })} tone={t.pnlUsdt >= 0 ? 'buy' : 'sell'} />
                  ) : (
                    <Badge text="OPEN" tone="info" />
                  )}
                </View>
                <Row left="Entry / Exit" right={`${fmtPrice(t.entryPrice)} → ${t.exitPrice ? fmtPrice(t.exitPrice) : '—'}`} />
                <Text style={styles.reason}>{t.reason}</Text>
              </Card>
            ))
          ) : (
            <EmptyState icon="📜" title="No trades yet" />
          )}
        </>
      ) : null}

      {tab === 'log' ? (
        <Card>
          <CardTitle>ENGINE LOG (latest {Math.min(logs.length, 200)})</CardTitle>
          {logs.length ? (
            logs.map((l, i) => (
              <View key={`${l.at}-${i}`} style={styles.logRow}>
                <Text style={styles.logTime}>{new Date(l.at).toLocaleTimeString('en-US', { hour12: false })}</Text>
                <Text style={[styles.logLevel, { color: levelColor(l.level) }]}>{l.level.toUpperCase()}</Text>
                <Text style={styles.logMsg}>{l.message}</Text>
              </View>
            ))
          ) : (
            <EmptyState icon="🧾" title="Log is empty" subtitle="Engine activity appears here." />
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function levelColor(level: string): string {
  if (level === 'error') return colors.red;
  if (level === 'warn') return colors.gold;
  if (level === 'trade') return colors.green;
  return colors.textDim;
}

const styles = StyleSheet.create({
  posHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  symbol: { color: colors.text, fontSize: 15, fontWeight: '900' },
  side: { color: colors.green, fontSize: 11, fontWeight: '800' },
  mode: { color: colors.textFaint, fontSize: 10.5, marginTop: 2, fontWeight: '700', letterSpacing: 0.4 },
  reason: { color: colors.textFaint, fontSize: 11, marginTop: 8, lineHeight: 15 },
  logRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, alignItems: 'flex-start' },
  logTime: { color: colors.textFaint, fontSize: 10.5, width: 62 },
  logLevel: { fontSize: 9.5, fontWeight: '900', width: 42 },
  logMsg: { color: colors.textDim, fontSize: 11, flex: 1, lineHeight: 15 },
});
