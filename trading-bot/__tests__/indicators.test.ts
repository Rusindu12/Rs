import {
  sma,
  ema,
  rsi,
  macd,
  bollingerBands,
  stochastic,
  atr,
  vwap,
  ichimoku,
  fibonacci,
  volumeProfile,
  averageVolume,
  last,
  type Candle,
} from '../src/indicators/indicators';

const nan = (v: number) => Number.isNaN(v);

describe('SMA', () => {
  it('computes a rolling mean with NaN warm-up', () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out.map((v) => (nan(v) ? NaN : v))).toEqual([NaN, NaN, 2, 3, 4]);
  });
  it('handles short inputs', () => {
    expect(nan(sma([1], 3)[0])).toBe(true);
  });
});

describe('EMA', () => {
  it('seeds with SMA and applies the smoothing factor', () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[2]).toBeCloseTo(2);
    expect(out[3]).toBeCloseTo(3); // k=0.5: 4*0.5 + 2*0.5 = 3
    expect(out[4]).toBeCloseTo(4);
  });
});

describe('RSI (Wilder)', () => {
  it('is 100 for a constant rise', () => {
    const out = rsi(Array.from({ length: 30 }, (_, i) => i + 1), 14);
    expect(out[14]).toBe(100);
  });
  it('is 0 for a constant fall', () => {
    const out = rsi(Array.from({ length: 30 }, (_, i) => 100 - i), 14);
    expect(out[14]).toBe(0);
  });
  it('matches a hand-computed Wilder case (period 2)', () => {
    // closes: 1,2,3,2 → diffs +1,+1,-1
    const out = rsi([1, 2, 3, 2], 2);
    expect(out[2]).toBe(100); // avgLoss 0
    expect(out[3]).toBeCloseTo(50); // avgGain 0.5 / avgLoss 0.5
  });
});

describe('MACD', () => {
  it('produces bullish histogram on an accelerating uptrend', () => {
    // Quadratic growth keeps MACD separating from its signal line.
    const up = Array.from({ length: 80 }, (_, i) => 100 + i + 0.05 * i * i);
    const m = macd(up);
    expect(last(m.macd)).toBeGreaterThan(last(m.signal));
    expect(last(m.histogram)).toBeGreaterThan(0);
  });
  it('produces bearish histogram on an accelerating downtrend', () => {
    const down = Array.from({ length: 80 }, (_, i) => 500 - i - 0.05 * i * i);
    const m = macd(down);
    expect(last(m.histogram)).toBeLessThan(0);
  });
});

describe('Bollinger Bands', () => {
  it('collapses to the constant value for flat series', () => {
    const bb = bollingerBands(new Array(30).fill(50), 20, 2);
    expect(last(bb.upper)).toBeCloseTo(50);
    expect(last(bb.lower)).toBeCloseTo(50);
    expect(last(bb.middle)).toBeCloseTo(50);
  });
  it('matches a hand-computed 3-point band', () => {
    const bb = bollingerBands([1, 2, 3], 3, 2);
    const sd = Math.sqrt(2 / 3);
    expect(last(bb.middle)).toBeCloseTo(2);
    expect(last(bb.upper)).toBeCloseTo(2 + 2 * sd);
    expect(last(bb.lower)).toBeCloseTo(2 - 2 * sd);
  });
});

describe('Stochastic', () => {
  it('returns 50 on flat series (hh == ll guard)', () => {
    const k = stochastic(
      new Array(30).fill(10),
      new Array(30).fill(10),
      new Array(30).fill(10),
      14,
      3,
      3
    );
    expect(last(k.k)).toBeCloseTo(50);
  });
  it('pins to 100 when closing at the top of the range', () => {
    const highs = Array.from({ length: 30 }, (_, i) => i + 2);
    const lows = Array.from({ length: 30 }, (_, i) => i);
    const closes = Array.from({ length: 30 }, (_, i) => i + 2);
    const k = stochastic(highs, lows, closes, 14, 3, 3);
    expect(last(k.k)).toBeCloseTo(100);
  });
});

describe('ATR', () => {
  it('equals the mean of true ranges in the first window', () => {
    const candles: Candle[] = [
      { openTime: 0, open: 10, high: 12, low: 9, close: 11, volume: 1, closeTime: 0, quoteVolume: 1, trades: 1 },
      { openTime: 1, open: 11, high: 15, low: 10, close: 14, volume: 1, closeTime: 1, quoteVolume: 1, trades: 1 },
      { openTime: 2, open: 14, high: 16, low: 13, close: 13, volume: 1, closeTime: 2, quoteVolume: 1, trades: 1 },
      { openTime: 3, open: 13, high: 14, low: 12, close: 12.5, volume: 1, closeTime: 3, quoteVolume: 1, trades: 1 },
    ];
    // TRs: [NaN, max(5,4,4)=5, max(3,2,3)=3, max(2,1,1)=2] → mean 10/3
    const out = atr(candles, 3);
    expect(out[3]).toBeCloseTo(10 / 3, 6);
  });
});

describe('VWAP', () => {
  it('weights by volume', () => {
    const c = (price: number, vol: number): Candle => ({
      openTime: 0, open: price, high: price, low: price, close: price,
      volume: vol, closeTime: 0, quoteVolume: price * vol, trades: 1,
    });
    const out = vwap([c(100, 1), c(200, 3)]);
    // typical = price when h=l=c → (100*1 + 200*3) / 4 = 175
    expect(out[1]).toBeCloseTo(175);
  });
});

describe('Ichimoku', () => {
  it('tenkan is the 9-period midpoint', () => {
    const candles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
      openTime: i, open: i, high: i + 1, low: i - 1, close: i,
      volume: 1, closeTime: i, quoteVolume: 1, trades: 1,
    }));
    const ich = ichimoku(candles);
    const i = candles.length - 1;
    const hh = Math.max(...candles.slice(i - 8, i + 1).map((c) => c.high));
    const ll = Math.min(...candles.slice(i - 8, i + 1).map((c) => c.low));
    expect(ich.tenkan[i]).toBeCloseTo((hh + ll) / 2);
  });
});

describe('Fibonacci', () => {
  it('produces canonical retracement ratios', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
      openTime: i, open: 50, high: 50, low: 50, close: 50,
      volume: 1, closeTime: i, quoteVolume: 1, trades: 1,
    }));
    candles[5].high = 110;
    candles[5].low = 10;
    const fib = fibonacci(candles);
    const ratios = fib.levels.map((l) => l.ratio);
    expect(ratios).toEqual([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
    expect(fib.high).toBe(110);
    expect(fib.low).toBe(10);
  });
});

describe('Volume Profile', () => {
  it('finds the POC where most volume traded', () => {
    const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      openTime: i, open: 100, high: 100.5, low: 99.5, close: 100,
      volume: 1, closeTime: i, quoteVolume: 100, trades: 1,
    }));
    candles[10].volume = 1000;
    const vp = volumeProfile(candles, 10);
    // Heaviest candle's typical price (100.0) falls into the bin centred at 100.05.
    expect(vp.poc).toBeCloseTo(100.05, 2);
  });
  it('captures ≥70% of volume in the value area', () => {
    const candles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
      openTime: i, open: 10 + i, high: 10.5 + i, low: 9.5 + i, close: 10 + i,
      volume: 1, closeTime: i, quoteVolume: 1, trades: 1,
    }));
    const vp = volumeProfile(candles, 8);
    const total = vp.bins.reduce((s, b) => s + b.volume, 0);
    const inArea = vp.bins
      .filter((b) => b.price >= vp.val && b.price <= vp.vah)
      .reduce((s, b) => s + b.volume, 0);
    expect(inArea / total).toBeGreaterThanOrEqual(0.69);
  });
});

describe('averageVolume', () => {
  it('averages the last window', () => {
    expect(averageVolume([1, 2, 3, 4, 5], 2)).toBe(4.5);
  });
});

describe('last', () => {
  it('returns NaN on empty input', () => {
    expect(nan(last([]))).toBe(true);
  });
});
