/** Number / money formatting helpers. */

export function fmtPrice(v: number | undefined | null): string {
  if (v == null || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  let d: number;
  if (abs >= 1000) d = 2;
  else if (abs >= 100) d = 2;
  else if (abs >= 1) d = 3;
  else if (abs >= 0.01) d = 5;
  else d = 7;
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtUsd(v: number | undefined | null, opts?: { sign?: boolean }): string {
  if (v == null || !isFinite(v)) return '—';
  const sign = opts?.sign && v > 0 ? '+' : v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : 4;
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtPct(v: number | undefined | null, opts?: { sign?: boolean }): string {
  if (v == null || !isFinite(v)) return '—';
  const sign = opts?.sign === false ? '' : v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

export function fmtQty(v: number): string {
  if (!isFinite(v)) return '—';
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

export function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(2);
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function baseAsset(symbol: string): string {
  return symbol.replace(/USDT$/, '').replace(/BUSD$/, '').replace(/USDC$/, '');
}
