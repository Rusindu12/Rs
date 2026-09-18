import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, CardTitle, Chip, ConfirmModal, EmptyState, Row, Screen, StatusDot, HeroCard } from '../components/ui';
import { Sparkline, ConfidenceGauge } from '../components/Sparkline';
import { colors } from '../theme';
import { TOP_TICKERS } from '../config';
import { runtime } from '../engine/runtime';
import { useAuthStore } from '../store/authStore';
import { useBotStore } from '../store/botStore';
import { marketSentiment, useMarketStore, type TickerView } from '../store/marketStore';
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
  const simulated = useAuthStore((s) => s.simulated);
  const running = useBotStore((s) => s.running);
  const positions = useBotStore((s) => s.positions);
  const signals = useBotStore((s) => s.signals);
  const trades = useBotStore((s) => s.trades);

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

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

  /** Market breadth: share of watchlist symbols up over 24h. */
  const breadth = useMemo(() => {
    const list = TOP_TICKERS.map((s) => tickers[s]).filter(Boolean) as TickerView[];
    if (!list.length) return { upPct: 0, up: 0, total: 0 };
    const up = list.filter((t) => t.changePct > 0).length;
    return { upPct: (up / list.length) * 100, up, total: list.length };
  }, [tickers]);

  const best = useMemo(() => {
    if (!signals.length) return null;
    return signals.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  }, [signals]);

  const aiConfidence = signals.length ? best!.confidence : 0;

  const pnlBuckets = useMemo(() => {
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
          <Text style={styles.connText}>WS</Text>
        </View>
        {demoMode ? <Badge text="DEMO" tone="gold" small /> : null}
        <Badge text={environment === 'live' ? 'LIVE PRICES' : 'TESTNET'} tone={environment === 'live' ? 'gold' : 'info'} small />
        <Badge text={portfolio ? portfolio.source.toUpperCase() : '…'} tone="neutral" small />
      </View>

      {/* hero — portfolio value */}
      <HeroCard>
        <View style={styles.heroHead}>
          <Text style={styles.heroLabel}>PORTFOLIO VALUE</Text>
          <Badge text={running ? '● BOT RUNNING' : 'BOT IDLE'} tone={running ? 'buy' : 'neutral'} small />
        </View>
        <Text style={styles.heroEquity}>{fmtUsd(equity)}</Text>
        <Text style={styles.heroSub}>
          <Text style={{ color: pnlBuckets.daily >= 0 ? colors.green : colors.red }}>
            {fmtUsd(pnlBuckets.daily, { sign: true })} today
          </Text>
          <Text style={styles.heroDot}> · unrealized </Text>
          <Text style={{ color: pnlBuckets.unrealized >= 0 ? colors.green : colors.red }}>
            {fmtUsd(pnlBuckets.unrealized, { sign: true })}
          </Text>
        </Text>
        <View style={styles.assetRow}>
          <AssetPill asset="USDT" glyph="$" amount={portfolio?.usdt} price={1} />
          <AssetPill asset="BTC" glyph="₿" amount={portfolio?.btc} price={tickers.BTCUSDT?.price} />
          <AssetPill asset="ETH" glyph="Ξ" amount={portfolio?.eth} price={tickers.ETHUSDT?.price} />
        </View>
      </HeroCard>

      {/* P/L grid */}
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

      {/* AI engine */}
      <Card>
        <CardTitle>🧠 AI ENGINE</CardTitle>
        <View style={styles.aiRow}>
          <ConfidenceGauge value={aiConfidence} label="CONFIDENCE" />
          <View style={styles.aiMeta}>
            <Text style={styles.aiSmallLabel}>MARKET SENTIMENT</Text>
            <Badge
              text={sentiment.label}
              tone={sentiment.label === 'Bullish' ? 'buy' : sentiment.label === 'Bearish' ? 'sell' : 'neutral'}
            />
            {/* breadth bar */}
            <View style={styles.breadthTrack}>
              <View style={[styles.breadthUp, { width: `${breadth.upPct}%` }]} />
            </View>
            <Text style={styles.aiTiny}>
              {breadth.up}/{breadth.total} up (24h) · avg {fmtPct(sentiment.avgChangePct)}
            </Text>
            {best ? (
              <Chip
                label="TOP SIGNAL"
                value={`${best.symbol} ${best.action.replace('_', ' ')} · ${best.confidence}%`}
                tone={best.action.includes('BUY') ? 'buy' : best.action.includes('SELL') ? 'sell' : 'gold'}
              />
            ) : (
              <Text style={styles.aiTiny}>Run the engine to generate signals</Text>
            )}
          </View>
        </View>
      </Card>

      {!wsConnected && (
        <View style={[styles.netBanner, { backgroundColor: demoMode ? '#1E80FF14' : '#F6465D14', borderColor: demoMode ? '#1E80FF66' : '#F6465D66' }]}>
          <Text style={[styles.netBannerTitle, { color: demoMode ? colors.blue : colors.red }]}>
            📡 {demoMode ? 'Offline — demo trading continues with simulated prices' : 'Offline — trading paused'}
          </Text>
          <Text style={styles.netBannerText}>
            {demoMode
              ? 'Paper trading keeps running on simulated prices while the internet is down. Real prices resume automatically.'
              : 'Real orders need internet. The bot pauses safely and resumes automatically when you are back online.'}
          </Text>
        </View>
      )}
      {!running && (
        <View style={styles.idleBanner}>
          <Text style={styles.idleBannerTitle}>⚠ Bot is IDLE — trading is OFF</Text>
          <Text style={styles.idleBannerText}>Press ▶ Start below. In demo mode it now starts automatically.</Text>
        </View>
      )}

      {/* quick actions */}
      <Card>
        <CardTitle>QUICK ACTIONS</CardTitle>
        <View style={styles.actionsRow}>
          <Button
            label="▶ Start"
            tone="success"
            disabled={running}
            onPress={() => runtime.startBot()}
            style={styles.actionBtn}
          />
          <Button
            label="⏸ Stop"
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
            return <TickerRow key={sym} ticker={t} />;
          })
        )}
      </Card>

      <ConfirmModal
        visible={confirmStop}
        title="Emergency stop everything?"
        message="The bot halts, ALL open positions are market-closed at current prices, and resting orders are cancelled. This cannot be undone."
        confirmLabel="Close everything"
        danger
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => {
          setConfirmStop(false);
          void runtime.emergencyStop();
        }}
      />
    </Screen>
  );
}

/** Ticker row with a short green/red flash when the price ticks. */
function TickerRow({ ticker }: { ticker: TickerView }) {
  const prev = useRef(ticker.price);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (ticker.price !== prev.current) {
      const dir = ticker.price > prev.current ? 'up' : 'down';
      prev.current = ticker.price;
      setFlash(dir);
      const t = setTimeout(() => setFlash(null), 700);
      return () => clearTimeout(t);
    }
  }, [ticker.price]);

  return (
    <View style={[styles.tickerRow, flash ? { backgroundColor: flash === 'up' ? '#0ECB8114' : '#F6465D14' } : null]}>
      <View style={styles.tickerName}>
        <Text style={styles.tickerSymbol}>{baseAsset(ticker.symbol)}</Text>
        <Text style={styles.tickerVol}>Vol {fmtUsd(ticker.quoteVolume, { sign: false })}</Text>
      </View>
      <Sparkline data={ticker.history} positive={ticker.changePct >= 0} />
      <View style={styles.tickerPrice}>
        <Text
          style={[
            styles.tickerPriceText,
            flash ? { color: flash === 'up' ? colors.green : colors.red } : null,
          ]}
        >
          {fmtPrice(ticker.price)}
        </Text>
        <Text style={[styles.tickerChange, { color: ticker.changePct >= 0 ? colors.green : colors.red }]}>
          {ticker.changePct >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(ticker.changePct), { sign: false })}
        </Text>
      </View>
    </View>
  );
}

function AssetPill({ asset, glyph, amount, price }: { asset: string; glyph: string; amount?: number; price?: number }) {
  const value = amount != null && price != null ? amount * price : null;
  return (
    <View style={styles.assetPill}>
      <Text style={styles.assetGlyph}>{glyph}</Text>
      <Text style={styles.assetName}>{asset}</Text>
      <Text style={styles.assetAmount}>{amount != null ? amount.toFixed(asset === 'USDT' ? 2 : 6) : '—'}</Text>
      <Text style={styles.assetValue}>{value != null ? fmtUsd(value) : '—'}</Text>
    </View>
  );
}

function PnlCell({ label, value, pct }: { label: string; value: number; pct: number }) {
  const c = value > 0 ? colors.green : value < 0 ? colors.red : colors.textDim;
  return (
    <View style={[styles.pnlCell, { borderColor: c + '33', backgroundColor: c + '0D' }]}>
      <Text style={styles.pnlLabel}>{label}</Text>
      <Text style={[styles.pnlValue, { color: c }]}>{fmtUsd(value, { sign: true })}</Text>
      <Text style={[styles.pnlPct, { color: c }]}>{fmtPct(pct)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  netBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  netBannerTitle: { fontWeight: '800', fontSize: 12 },
  netBannerText: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  idleBanner: {
    backgroundColor: '#F0B90B14',
    borderColor: '#F0B90B66',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  idleBannerTitle: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  idleBannerText: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  connItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  connText: { color: colors.textDim, fontSize: 11.5 },
  heroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroEquity: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: 0.4, marginTop: 8 },
  heroSub: { color: colors.textDim, fontSize: 12.5, marginTop: 4 },
  heroDot: { color: colors.textFaint },
  assetRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  assetPill: {
    flex: 1,
    backgroundColor: '#0B0E1199',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2B3340',
  },
  assetGlyph: { color: colors.gold, fontSize: 14, fontWeight: '900' },
  assetName: { color: colors.textDim, fontSize: 10, fontWeight: '700', marginTop: 2 },
  assetAmount: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  assetValue: { color: colors.textFaint, fontSize: 10.5, marginTop: 2 },
  pnlGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pnlCell: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  pnlLabel: { color: colors.textDim, fontSize: 10.5, fontWeight: '600' },
  pnlValue: { fontSize: 12.5, fontWeight: '800', marginTop: 4 },
  pnlPct: { fontSize: 10.5, marginTop: 2 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aiMeta: { flex: 1, gap: 7 },
  aiSmallLabel: { color: colors.textDim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  aiTiny: { color: colors.textFaint, fontSize: 11 },
  breadthTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.redDim,
    overflow: 'hidden',
  },
  breadthUp: { height: 6, backgroundColor: colors.green, borderRadius: 3 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1 },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 10,
    borderRadius: 10,
  },
  tickerName: { flex: 1 },
  tickerSymbol: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  tickerVol: { color: colors.textFaint, fontSize: 10 },
  tickerPrice: { alignItems: 'flex-end', width: 100 },
  tickerPriceText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tickerChange: { fontSize: 11, fontWeight: '700' },
});
