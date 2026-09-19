import Big from 'big.js';

export const formatPrice = (price: number | string, decimals?: number): string => {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '0.00';
  if (decimals !== undefined) return num.toFixed(decimals);
  if (num >= 10000) return num.toFixed(2);
  if (num >= 100) return num.toFixed(2);
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.01) return num.toFixed(6);
  return num.toFixed(8);
};

export const formatCurrency = (amount: number | string, currency: string = '$'): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${currency}0.00`;
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs >= 1e9) return `${sign}${currency}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${currency}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${currency}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${sign}${currency}${abs.toFixed(2)}`;
};

export const formatPercentage = (value: number | string, decimals: number = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00%';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
};

export const formatQuantity = (quantity: number | string, stepSize: number): string => {
  const q = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
  if (isNaN(q)) return '0';
  const precision = getStepPrecision(stepSize);
  return q.toFixed(precision);
};

const getStepPrecision = (stepSize: number): number => {
  const str = stepSize.toString();
  const dotIndex = str.indexOf('.');
  if (dotIndex === -1) return 0;
  let precision = str.length - dotIndex - 1;
  let lastNonZero = precision;
  for (let i = str.length - 1; i > dotIndex; i--) {
    if (str[i] !== '0') {
      lastNonZero = i - dotIndex;
      break;
    }
  }
  return lastNonZero;
};

export const formatLargeNumber = (num: number): string => {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

export const formatPnl = (pnl: number, includeSign: boolean = true): string => {
  const sign = pnl >= 0 ? '+' : '';
  const prefix = includeSign ? sign : '';
  return `${prefix}$${Math.abs(pnl).toFixed(2)}`;
};

export const formatPnlColor = (pnl: number): string => {
  if (pnl > 0) return '#0ECB81';
  if (pnl < 0) return '#F6465D';
  return '#848E9C';
};

export const formatPairName = (symbol: string): string => {
  const quoteAssets = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB'];
  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      return `${base}/${quote}`;
    }
  }
  return symbol;
};

export const parsePairName = (pair: string): { base: string; quote: string } => {
  const parts = pair.split('/');
  if (parts.length === 2) {
    return { base: parts[0], quote: parts[1] };
  }
  const quoteAssets = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB'];
  for (const quote of quoteAssets) {
    if (pair.endsWith(quote)) {
      return { base: pair.slice(0, -quote.length), quote };
    }
  }
  return { base: pair, quote: '' };
};

export const calculateSpread = (bid: number, ask: number): number => {
  if (ask === 0) return 0;
  return new Big(ask).minus(bid).div(ask).times(100).toNumber();
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hrs}h`;
};

export const formatTimestamp = (timestamp: number | string): string => {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatTimeAgo = (timestamp: number | string): string => {
  const now = Date.now();
  const then = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
};
