/**
 * Offline price simulator — keeps PAPER trading alive when the internet drops.
 * A mean-reverting random walk anchored at the last REAL price seen, bounded to
 * ±12% so the simulation never drifts into fantasy-land. Demo mode only.
 */

/** Deterministic per-symbol RNG. */
export function simRng(seedStr: string): () => number {
  let s = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const SIM_STEP_PCT = 0.0012; // ±0.12% per 3s step
export const SIM_BAND = 0.12; // never beyond ±12% of the last real price

/** One simulator step. `anchor` = last real price observed before going offline. */
export function simStep(price: number, rand: () => number, anchor: number): number {
  const pull = ((anchor - price) / Math.max(1e-9, anchor)) * 0.02; // gentle mean reversion
  let next = price * (1 + (rand() * 2 - 1) * SIM_STEP_PCT + pull);
  const lo = anchor * (1 - SIM_BAND);
  const hi = anchor * (1 + SIM_BAND);
  next = Math.max(lo, Math.min(hi, next));
  return next;
}
