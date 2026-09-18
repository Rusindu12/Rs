import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, Card, CardTitle, Chip, Screen, StatusDot } from '../components/ui';
import { Sparkline } from '../components/Sparkline';
import { colors } from '../theme';
import { runtime } from '../engine/runtime';
import { useAuthStore } from '../store/authStore';
import { useBotStore } from '../store/botStore';
import { fmtUsd } from '../utils/format';
import { APP_VERSION } from '../config';

/** Equity curve starts from the paper balance (or current equity for live). */
const START_BALANCE = 10_000;

interface AiSummary {
  trained: { at: string; source: string; classAcc: number; adopted: boolean; buyAcc: number | null; sellAcc: number | null; holdAcc: number | null };
  adaptive: { evaluated: number; correct: number; accuracy: number };
}

interface Perf {
  closed: number;
  wins: number;
  winRate: number;
  pnl: number;
  best: number;
  bestSym: string;
  streak: number;
  curve: number[];
}

export function ProfileScreen() {
  const demoMode = useAuthStore((s) => s.demoMode);
  const environment = useAuthStore((s) => s.environment);
  const wsConnected = useAuthStore((s) => s.wsConnected);
  const trades = useBotStore((s) => s.trades);
  const positions = useBotStore((s) => s.positions);
  const running = useBotStore((s) => s.running);

  const [equity, setEquity] = useState<number | null>(null);
  const [alloc, setAlloc] = useState<{ usdt: number; btc: number; eth: number } | null>(null);
  const [ai, setAi] = useState<AiSummary | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const p = await runtime.portfolio();
        if (alive) {
          setEquity(p.equityUsdt);
          setAlloc({ usdt: p.usdt, btc: p.btc, eth: p.eth });
        }
      } catch {
        /* feed not ready */
      }
      try {
        const s = runtime.learningSummary();
        if (alive) setAi({ trained: s.trained, adaptive: s.adaptive });
      } catch {
        /* runtime not wired yet */
      }
    };
    void load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [trades.length]);

  const perf: Perf = useMemo(() => {
    const closed = trades
      .filter((t) => t.status === 'CLOSED')
      .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
    const wins = closed.filter((t) => (t.pnlUsdt ?? 0) > 0);
    let streak = 0;
    for (let i = closed.length - 1; i >= 0; i--) {
      if ((closed[i].pnlUsdt ?? 0) > 0) streak++;
      else break;
    }
    let best = 0;
    let bestSym = '—';
    for (const t of closed) {
      if ((t.pnlUsdt ?? 0) > best) {
        best = t.pnlUsdt ?? 0;
        bestSym = t.symbol;
      }
    }
    let cum = 0;
    const curve = [0, ...closed.map((t) => (cum += t.pnlUsdt ?? 0))];
    return {
      closed: closed.length,
      wins: wins.length,
      winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
      pnl: closed.reduce((s, t) => s + (t.pnlUsdt ?? 0), 0),
      best,
      bestSym,
      streak,
      curve,
    };
  }, [trades]);

  const mode = demoMode ? 'DEMO' : environment === 'live' ? 'LIVE' : 'TESTNET';
  const modeTone = demoMode ? 'gold' : environment === 'live' ? 'buy' : 'info';
  const modeNote = demoMode
    ? 'Simulated funds · live market prices'
    : environment === 'live'
      ? 'Real funds on Binance Spot'
      : 'Binance testnet · simulated funds';

  const aiLevel = !ai ? 1 : ai.trained.adopted ? (ai.adaptive.evaluated > 20 ? 3 : 2) : 1;
  const aiTitle = ['AI Trainee', 'AI Trader', 'AI Pro'][aiLevel - 1];
  const aiIcon = ['🎓', '🤖', '🧠'][aiLevel - 1];

  const badges = useMemo(
    () => [
      { icon: '🚀', label: 'First Trade', got: perf.closed >= 1 },
      { icon: '📈', label: '10 Trades', got: perf.closed >= 10 },
      { icon: '🎯', label: 'Sharp 60%', got: perf.closed >= 5 && perf.winRate >= 60 },
      { icon: '🔥', label: 'Streak ×3', got: perf.streak >= 3 },
      { icon: '💰', label: 'Profitable', got: perf.pnl > 0 },
      { icon: '🧠', label: 'Quick Learner', got: (ai?.adaptive.evaluated ?? 0) >= 5 },
      { icon: '🛡️', label: 'Trained AI', got: ai?.trained.adopted ?? false },
      { icon: '💎', label: 'Diamond Hands', got: perf.curve.length > 1 && perf.curve[perf.curve.length - 1] > 100 },
    ],
    [perf, ai]
  );

  const classBars = ai
    ? [
        { label: 'BUY', v: ai.trained.buyAcc, c: colors.green },
        { label: 'SELL', v: ai.trained.sellAcc, c: colors.red },
        { label: 'HOLD', v: ai.trained.holdAcc, c: colors.gold },
      ]
    : [];

  return (
    <Screen>
      {/* ── Hero ─────────────────────────────────────────── */}
      <LinearGradient colors={['#1E2329', '#0B0E11']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.avatarWrap}>
            <LinearGradient colors={['#F0B90B', '#C99409']} style={styles.avatar}>
              <Text style={styles.avatarIcon}>{aiIcon}</Text>
            </LinearGradient>
            <View style={[styles.statusPill, { borderColor: wsConnected ? colors.green : colors.red }]}>
              <StatusDot ok={wsConnected} />
              <Text style={[styles.statusPillText, { color: wsConnected ? colors.green : colors.red }]}>
                {wsConnected ? 'live feed' : 'offline'}
              </Text>
            </View>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>AI Trader</Text>
            <Text style={styles.heroSub}>{aiTitle} · v{APP_VERSION}</Text>
            <View style={styles.heroChips}>
              <Badge text={mode} tone={modeTone} />
              {running ? <Badge text="● BOT RUNNING" tone="buy" small /> : <Badge text="bot idle" tone="neutral" small />}
            </View>
          </View>
        </View>
        <View style={styles.equityRow}>
          <View>
            <Text style={styles.equityLabel}>Portfolio value</Text>
            <Text style={styles.equityValue}>{equity != null ? fmtUsd(equity) : '—'}</Text>
            <Text style={styles.equityNote}>{modeNote}</Text>
          </View>
          {perf.curve.length > 2 && (
            <View style={styles.sparkWrap}>
              <Sparkline data={perf.curve.map((v) => START_BALANCE + v)} width={110} height={40} positive={perf.pnl >= 0} />
              <Text style={[styles.sparkPnl, { color: perf.pnl >= 0 ? colors.green : colors.red }]}>
                {perf.pnl >= 0 ? '+' : ''}
                {fmtUsd(perf.pnl)}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* ── Performance ──────────────────────────────────── */}
      <Card>
        <CardTitle>Performance</CardTitle>
        <View style={styles.grid4}>
          <Stat label="Closed trades" value={String(perf.closed)} />
          <Stat label="Win rate" value={perf.closed ? `${perf.winRate.toFixed(0)}%` : '—'} tone={perf.closed ? (perf.winRate >= 50 ? colors.green : colors.red) : undefined} />
          <Stat
            label="Total PnL"
            value={`${perf.pnl >= 0 ? '+' : ''}${fmtUsd(perf.pnl)}`}
            tone={perf.pnl > 0 ? colors.green : perf.pnl < 0 ? colors.red : undefined}
          />
          <Stat label="Best trade" value={perf.closed && perf.best > 0 ? `+${fmtUsd(perf.best)}` : '—'} sub={perf.bestSym !== '—' ? perf.bestSym.replace('USDT', '') : undefined} tone={perf.best > 0 ? colors.green : undefined} />
        </View>
        <View style={styles.chipRow}>
          <Chip label="Open" value={String(positions.length)} tone="info" />
          <Chip label="Win streak" value={perf.streak > 0 ? `×${perf.streak}` : '—'} tone={perf.streak >= 3 ? 'buy' : 'neutral'} />
          <Chip label="Mode" value={mode} tone={modeTone} />
        </View>
        {alloc && (
          <View style={styles.chipRow}>
            <Chip label="USDT" value={fmtUsd(alloc.usdt)} tone="neutral" />
            {alloc.btc > 0.00001 && <Chip label="BTC" value={alloc.btc.toFixed(5)} tone="gold" />}
            {alloc.eth > 0.00001 && <Chip label="ETH" value={alloc.eth.toFixed(4)} tone="info" />}
          </View>
        )}
      </Card>

      {/* ── AI Brain ─────────────────────────────────────── */}
      {ai && (
        <Card>
          <CardTitle>
            <Text>🧠 AI Brain</Text>
          </CardTitle>
          <View style={styles.aiRow}>
            <View style={styles.aiAcc}>
              <Text style={styles.aiAccValue}>{ai.trained.classAcc.toFixed(1)}%</Text>
              <Text style={styles.aiAccLabel}>trained accuracy</Text>
              <Badge text={ai.trained.source === 'binance-live' ? 'real market data' : ai.trained.source} tone={ai.trained.source === 'binance-live' ? 'buy' : 'gold'} small />
            </View>
            <View style={styles.classBars}>
              {classBars.map((b) => (
                <View key={b.label} style={styles.classBarRow}>
                  <Text style={styles.classBarLabel}>{b.label}</Text>
                  <View style={styles.classBarTrack}>
                    <View style={[styles.classBarFill, { width: `${Math.max(0, Math.min(100, b.v ?? 0))}%`, backgroundColor: b.c }]} />
                  </View>
                  <Text style={styles.classBarValue}>{b.v != null ? `${b.v.toFixed(0)}%` : '—'}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.adaptiveRow, { borderLeftColor: ai.adaptive.evaluated > 0 ? colors.gold : colors.border }]}>
            <Text style={styles.adaptiveText}>
              <Text style={styles.adaptiveBold}>Live learning:</Text> {ai.adaptive.evaluated} signal{ai.adaptive.evaluated === 1 ? '' : 's'} resolved ·{' '}
              {ai.adaptive.evaluated ? `${ai.adaptive.accuracy.toFixed(0)}% were right` : 'collecting…'}
            </Text>
          </View>
          <Text style={styles.trainedAt}>trained {new Date(ai.trained.at).toLocaleDateString()} · adapts every 2h while the app runs</Text>
        </Card>
      )}

      {/* ── Achievements ─────────────────────────────────── */}
      <Card>
        <CardTitle right={<Badge text={`${badges.filter((b) => b.got).length}/${badges.length}`} tone="gold" small />}>Achievements</CardTitle>
        <View style={styles.badgeGrid}>
          {badges.map((b) => (
            <View key={b.label} style={[styles.badgeCell, !b.got && styles.badgeCellLocked]}>
              <Text style={[styles.badgeIcon, !b.got && { opacity: 0.25 }]}>{b.icon}</Text>
              <Text style={[styles.badgeLabel, !b.got && { color: colors.textFaint }]}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={styles.footer}>
        {demoMode ? 'Demo mode — connect API keys in Settings to trade for real.' : `${mode} account · keys secured on-device`}
      </Text>
    </Screen>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone ? { color: tone } : undefined]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { alignItems: 'center', gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0B90B55',
  },
  avatarIcon: { fontSize: 30 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#0B0E11AA',
  },
  statusPillText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  heroInfo: { flex: 1, gap: 4 },
  heroName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  heroSub: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  heroChips: { flexDirection: 'row', gap: 6, marginTop: 2 },
  equityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 },
  equityLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  equityValue: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 2 },
  equityNote: { color: colors.textFaint, fontSize: 10, marginTop: 3 },
  sparkWrap: { alignItems: 'flex-end', gap: 3 },
  sparkPnl: { fontSize: 12, fontWeight: '700' },
  grid4: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: {
    flexBasis: '48.5%',
    flexGrow: 1,
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  statLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  statSub: { color: colors.textFaint, fontSize: 10, marginTop: 1 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  aiRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  aiAcc: { alignItems: 'center', gap: 5, minWidth: 108 },
  aiAccValue: { color: colors.gold, fontSize: 28, fontWeight: '800' },
  aiAccLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  classBars: { flex: 1, gap: 7 },
  classBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  classBarLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700', width: 34 },
  classBarTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  classBarFill: { height: '100%', borderRadius: 4 },
  classBarValue: { color: colors.text, fontSize: 10, fontWeight: '700', width: 32, textAlign: 'right' },
  adaptiveRow: { marginTop: 12, borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 2 },
  adaptiveText: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  adaptiveBold: { color: colors.text, fontWeight: '700' },
  trainedAt: { color: colors.textFaint, fontSize: 10, marginTop: 8 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeCell: {
    flexBasis: '23.5%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0B90B44',
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  badgeCellLocked: { borderColor: colors.border, opacity: 0.75 },
  badgeIcon: { fontSize: 22 },
  badgeLabel: { color: colors.text, fontSize: 9, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  footer: { color: colors.textFaint, fontSize: 11, textAlign: 'center', paddingVertical: Platform.OS === 'android' ? 14 : 20 },
});
