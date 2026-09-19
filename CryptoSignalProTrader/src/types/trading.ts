import { BinanceOrderSide, BinanceOrderType, BinanceTimeInForce } from './binance';

export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'EXPIRED' | 'PARTIALLY_FILLED';

export type TradeSide = 'BUY' | 'SELL';

export interface Trade {
  id: number;
  binanceOrderId: string;
  symbol: string;
  side: TradeSide;
  orderType: BinanceOrderType;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  totalValue: number;
  status: TradeStatus;
  stopLoss: number;
  takeProfit: number;
  trailingStop: number | null;
  trailingStopActivated: boolean;
  breakevenActivated: boolean;
  feePaid: number;
  grossPnl: number | null;
  netPnl: number | null;
  pnlPercentage: number | null;
  signalId: number | null;
  strategyUsed: string;
  isPaperTrade: boolean;
  durationSeconds: number | null;
  exitReason: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface OpenOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  type: BinanceOrderType;
  side: BinanceOrderSide;
  stopPrice: string;
  time: number;
  updateTime: number;
}

export interface OrderRequest {
  symbol: string;
  side: BinanceOrderSide;
  type: BinanceOrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: BinanceTimeInForce;
  newClientOrderId?: string;
  icebergQty?: number;
  quoteOrderQty?: number;
}

export interface OCOOrderRequest {
  symbol: string;
  side: BinanceOrderSide;
  quantity: number;
  price: number;
  stopPrice: number;
  stopLimitPrice: number;
  stopLimitTimeInForce: BinanceTimeInForce;
  listClientOrderId?: string;
  limitClientOrderId?: string;
  stopClientOrderId?: string;
}

export interface TradePreview {
  symbol: string;
  side: TradeSide;
  orderType: BinanceOrderType;
  quantity: number;
  price: number;
  estimatedTotal: number;
  estimatedFee: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  potentialLoss: number | null;
  potentialGain: number | null;
  confidence: number | null;
}

export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossPnl: number;
  netPnl: number;
  feesPaid: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeDuration: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface DailyPerformance {
  id: number;
  date: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  grossPnl: number;
  netPnl: number;
  feesPaid: number;
  maxDrawdown: number;
  portfolioStart: number;
  portfolioEnd: number;
  bestTrade: number;
  worstTrade: number;
}

export interface TradeJournalEntry {
  tradeId: number;
  notes: string;
  tags: string[];
  chartScreenshot: string | null;
  lessonsLearned: string | null;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyAction {
  type: 'PANIC_CLOSE_ALL' | 'CANCEL_ALL_ORDERS' | 'PAUSE_TRADING' | 'RESUME_TRADING';
  reason: string;
  timestamp: string;
}

export interface PositionInfo {
  symbol: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  stopLoss: number;
  takeProfit: number;
  duration: number;
  signalConfidence: number;
}

export interface PortfolioSnapshot {
  totalValue: number;
  availableBalance: number;
  inPositions: number;
  unrealizedPnl: number;
  realizedPnlToday: number;
  totalFeesPaid: number;
  positions: PositionInfo[];
  timestamp: string;
}

export interface DCASchedule {
  symbol: string;
  amount: number;
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  nextExecution: string;
  totalInvested: number;
  totalQuantity: number;
  avgPrice: number;
}

export interface GridLevel {
  price: number;
  quantity: number;
  side: TradeSide;
  orderId: string | null;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
}

export interface GridStrategy {
  symbol: string;
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  investmentPerGrid: number;
  levels: GridLevel[];
  isActive: boolean;
  totalProfit: number;
}

export interface TrailingStopConfig {
  activationPercent: number;
  callbackPercent: number;
  isActivated: boolean;
  highestPrice: number;
  currentStopPrice: number;
}
