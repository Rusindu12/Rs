import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, CardTitle, ConfirmModal, EmptyState, Row, Screen, StatusDot } from '../components/ui';
import { Sparkline, ConfidenceGauge } from '../components/Sparkline';
import { colors } from '../theme';
import { TOP_TICKERS } from '../config';
import { runtime } from '../engine/runtime';
import { useAuthStore } from '../store/authStore';
import { useBotStore } from '../store/botStore';
import { marketSentiment, useMarketStore } from '../store/marketStore';
import { fmtPct, fmtPrice, fmtUsd, baseAsset } from '../utils/format';

interface Portfolio {
  usdt: number;
  btc: number;
  eth: number;
  equityUsdt: number;
  source: 'paper' | 'live';
}

export function DashboardScreen() {
  const tickers = useMarketStore((s) => s.tickers);
  const wsConnected = useAuthStore((s) => s.wsConnected);
  const restStatus = useAuthStore((s) => s.restStatus);
  const environment = useAuthStore((s) => s.environment);
  const demoMode = useAuthStore((s) => s.demoMode);
  const running = useBotStore((s) => s.running);
  const positions = useBotStore((s) => s.positions);
  const signals = useBotStore((s) => s.signals);
  const trades = useBotStore((s) => s.trades);

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const p = await runtime.portfolio();
        if (alive) setPortfolio(p);
      } catch {
        /* feed not ready */
      }
    };
    void load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [positions.length, environment]);

  const sentiment = useMemo(() => marketSentiment(tickers), [tickers]);

  const aiConfidence = useMemo(() => {
    if (!signals.length) return 0;
    return Math.max(...signals.map((s) => s.confidence));
  }, [signals]);

  const pnlBuckets = useMemo(() => {
    // Realized PnL from closed trades + unrealized from open positions.
    const closed = trades.filter((t) => t.status === 'CLOSED');
    const inRange = (from: number) =>
      closed.filter((t) => (t.closedAt ?? 0) >= from).reduce((s, t) => s + (t.pnlUsdt ?? 0), 0);
    const day = 86_400_000;
    const now = Date.now();
    const unrealized = positions.reduce((s, p) => {
      const price = tickers[p.symbol]?.price ?? p.entryPrice;
      return s + (price - p.entryPrice) * p.qty;
    }, 0);
    return {
      daily: inRange(now - day) + unrealized,
      weekly: inRange(now - 7 * day) + unrealized,
      monthly: inRange(now - 30 * day) + unrealized,
      allTime: closed.reduce((s, t) => s + (t.pnlUsdt ?? 0), 0) + unrealized,
      unrealized,
    };
  }, [trades, positions, tickers]);

  const equity = portfolio?.equityUsdt ?? 0;
  const pctOf = (v: number) => (equity > 0 ? (v / equity) * 100 : 0);

  const doEmergencyStop = async () => {
    setBusy(true);
    await runtime.emergencyStop();
    setBusy(false);
    setConfirmStop(false);
  };

  return (
    <Screen>
      {/* connection strip */}
      <View style={styles.connRow}>
        <View style={styles.connItem}>
          <StatusDot ok={restStatus === 'ok'} />
          <Text style={styles.connText}>REST</Text>
        </View>
        <View style={styles.connItem}>
          <StatusDot ok={wsConnected} />
          <Text style={styles.connText}>WebSocket</Text>
        </View>
        {demoMode ? <Badge text="DEMO" tone="gold" small /> : null}
        <Badge text={environment === 'live' ? 'LIVE PRICES' : 'TESTNET'} tone={environment === 'live' ? 'gold' : 'info'} small />
        <Badge text={portfolio ? portfolio.source.toUpperCase() : '…'} tone="neutral" small />
      </View>

      {/* portfolio */}
      <Card>
        <CardTitle right={<Badge text={running ? 'BOT RUNNING' : 'BOT IDLE'} tone={running ? 'buy' : 'neutral'} small />}>
          PORTFOLIO VALUE
        </CardTitle>
        <Text style={styles.equity}>{fmtUsd(equity)}</Text>
        <Text style={styles.equityPnl}>
          {fmtUsd(pnlBuckets.daily, { sign: true })} today · unrealized {fmtUsd(pnlBuckets.unrealized, { sign: true })}
        </Text>
        <View style={styles.assetRow}>
          <AssetPill asset="USDT" amount={portfolio?.usdt} price={1} />
          <AssetPill asset="BTC" amount={portfolio?.btc} price={tickers.BTCUSDT?.price} />
          <AssetPill asset="ETH" amount={portfolio?.eth} price={tickers.ETHUSDT?.price} />
        </View>
      </Card>

      {/* PnL */}
      <Card>
        <CardTitle>PROFIT / LOSS</CardTitle>
        <View style={styles.pnlGrid}>
          <PnlCell label="Daily" value={pnlBuckets.daily} pct={pctOf(pnlBuckets.daily)} />
          <PnlCell label="Weekly" value={pnlBuckets.weekly} pct={pctOf(pnlBuckets.weekly)} />
          <PnlCell label="Monthly" value={pnlBuckets.monthly} pct={pctOf(pnlBuckets.monthly)} />
          <PnlCell label="All-time" value={pnlBuckets.allTime} pct={pctOf(pnlBuckets.allTime)} />
        </View>
        <Row left="Active trades" right={`${positions.length} open · ${trades.filter((t) => t.status === 'CLOSED').length} closed`} />
      </Card>

      {/* AI confidence + sentiment */}
      <Card>
        <CardTitle>AI ENGINE</CardTitle>
        <View style={styles.aiRow}>
          <ConfidenceGauge value={aiConfidence} label="AI CONFIDENCE" />
          <View style={styles.aiMeta}>
            <Text style={styles.sentimentLabel}>MARKET SENTIMENT</Text>
            <Badge
              text={sentiment.label}
              tone={sentiment.label === 'Bullish' ? 'buy' : sentiment.label === 'Bearish' ? 'sell' : 'neutral'}
            />
            <Text style={styles.sentimentSub}>
              24h avg {fmtPct(sentiment.avgChangePct)} · {signals.length} symbols analysed
            </Text>
            <Text style={styles.sentimentSub}>
              Best signal:{' '}
              {signals.length
                ? `${signals.reduce((a, b) => (b.confidence > a.confidence ? b : a)).symbol} ${
                    signals.reduce((a, b) => (b.confidence > a.confidence ? b : a)).action
                  }`
                : '—'}
            </Text>
          </View>
        </View>
      </Card>

      {/* quick actions */}
      <Card>
        <CardTitle>QUICK ACTIONS</CardTitle>
        <View style={styles.actionsRow}>
          <Button
            label="▶ Start Bot"
            tone="success"
            disabled={running}
            onPress={() => runtime.startBot()}
            style={styles.actionBtn}
          />
          <Button
            label="⏸ Stop Bot"
            tone="ghost"
            disabled={!running}
            onPress={() => runtime.stopBot()}
            style={styles.actionBtn}
          />
        </View>
        <Button label="🚨 Emergency Stop — close everything" tone="danger" onPress={() => setConfirmStop(true)} />
      </Card>

      {/* top 10 tickers */}
      <Card>
        <CardTitle right={<StatusDot ok={wsConnected} />}>TOP 10 CRYPTOCURRENCIES</CardTitle>
        {Object.keys(tickers).length === 0 ? (
          <EmptyState icon="📡" title="Waiting for live prices…" subtitle="The market websocket connects automatically." />
        ) : (
          TOP_TICKERS.map((sym) => {
            const t = tickers[sym];
            if (!t) return null;
            return (
              <View key={sym} style={styles.tickerRow}>
                <View style={styles.tickerName}>
                  <Text style={styles.tickerSymbol}>{baseAsset(sym)}</Text>
                  <Text style={styles.tickerVol}>Vol {fmtUsd(t.quoteVolume, { sign: false })}</Text>
                </View>
                <Sparkline data={t.history} positive={t.changePct >= 0} />
                <View style={styles.tickerPrice}>
                  <Text style={styles.tickerPriceText}>{fmtPrice(t.price)}</Text>
                  <Text style={[styles.tickerChange, { color: t.changePct >= 0 ? colors.green : colors.red }]}>
                    {fmtPct(t.changePct)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

function AssetPill({ asset, amount, price }: { asset: string; amount?: number; price?: number }) {
  const value = amount != null && price != null ? amount * price : null;
  return (
    <View style={styles.assetPill}>
      <Text style={styles.assetName}>{asset}</Text>
      <Text style={styles.assetAmount}>{amount != null ? amount.toFixed(asset === 'USDT' ? 2 : 6) : '—'}</Text>
      <Text style={styles.assetValue}>{value != null ? fmtUsd(value) : '—'}</Text>
    </View>
  );
}

function PnlCell({ label, value, pct }: { label: string; value: number; pct: number }) {
  const c = value > 0 ? colors.green : value < 0 ? colors.red : colors.textDim;
  return (
    <View style={styles.pnlCell}>
      <Text style={styles.pnlLabel}>{label}</Text>
      <Text style={[styles.pnlValue, { color: c }]}>{fmtUsd(value, { sign: true })}</Text>
      <Text style={[styles.pnlPct, { color: c }]}>{fmtPct(pct)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  connItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  connText: { color: colors.textDim, fontSize: 11.5 },
  equity: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: 0.4 },
  equityPnl: { color: colors.textDim, fontSize: 12.5, marginTop: 2 },
  assetRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  assetPill: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assetName: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  assetAmount: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 3 },
  assetValue: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  pnlGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pnlCell: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pnlLabel: { color: colors.textDim, fontSize: 10.5, fontWeight: '600' },
  pnlValue: { fontSize: 12.5, fontWeight: '800', marginTop: 4 },
  pnlPct: { fontSize: 10.5, marginTop: 2 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiMeta: { flex: 1, gap: 7 },
  sentimentLabel: { color: colors.textDim, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  sentimentSub: { color: colors.textFaint, fontSize: 11.5 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1 },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 10,
  },
  tickerName: { flex: 1 },
  tickerSymbol: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  tickerVol: { color: colors.textFaint, fontSize: 10 },
  tickerPrice: { alignItems: 'flex-end', width: 96 },
  tickerPriceText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tickerChange: { fontSize: 11.5, fontWeight: '700' },
});
