export const Colors = {
  background: '#0B0E11',
  backgroundLight: '#12161C',
  card: '#1E2329',
  cardHover: '#2B3139',
  cardDark: '#161A1F',
  primary: '#F0B90B',
  primaryDark: '#C89A04',
  primaryLight: '#F5D060',
  buy: '#0ECB81',
  buyDark: '#0a9e64',
  buyLight: '#12e88f',
  sell: '#F6465D',
  sellDark: '#c93a4a',
  sellLight: '#ff5a6e',
  hold: '#F8A613',
  holdDark: '#d48f0f',
  holdLight: '#ffb93d',
  textPrimary: '#EAECEF',
  textSecondary: '#848E9C',
  textTertiary: '#5E6673',
  textInverse: '#0B0E11',
  border: '#2B3139',
  borderLight: '#3C4249',
  success: '#0ECB81',
  danger: '#F6465D',
  warning: '#F8A613',
  info: '#1E90FF',
  chartGrid: '#1E2329',
  chartLine: '#F0B90B',
  overlay: 'rgba(0, 0, 0, 0.7)',
  shimmer: '#2B3139',
  shadow: 'rgba(0, 0, 0, 0.3)',
  gradientBuy: ['#0ECB81', '#0a9e64'],
  gradientSell: ['#F6465D', '#c93a4a'],
  gradientPrimary: ['#F0B90B', '#C89A04'],
  gradientDark: ['#0B0E11', '#161A1F'],
  gradientCard: ['#1E2329', '#2B3139'],
  transparent: 'transparent',
};

export const getSignalColor = (signal: string): string => {
  switch (signal) {
    case 'STRONG_BUY':
    case 'BUY':
      return Colors.buy;
    case 'WEAK_BUY':
      return Colors.buyLight;
    case 'HOLD':
      return Colors.hold;
    case 'WEAK_SELL':
      return Colors.sellLight;
    case 'SELL':
    case 'STRONG_SELL':
      return Colors.sell;
    default:
      return Colors.textSecondary;
  }
};

export const getSignalBgColor = (signal: string): string => {
  switch (signal) {
    case 'STRONG_BUY':
    case 'BUY':
      return 'rgba(14, 203, 129, 0.15)';
    case 'WEAK_BUY':
      return 'rgba(14, 203, 129, 0.08)';
    case 'HOLD':
      return 'rgba(248, 166, 19, 0.15)';
    case 'WEAK_SELL':
      return 'rgba(246, 70, 93, 0.08)';
    case 'SELL':
    case 'STRONG_SELL':
      return 'rgba(246, 70, 93, 0.15)';
    default:
      return 'rgba(132, 142, 156, 0.1)';
  }
};

export const getPnlColor = (pnl: number): string => {
  if (pnl > 0) return Colors.buy;
  if (pnl < 0) return Colors.sell;
  return Colors.textSecondary;
};
