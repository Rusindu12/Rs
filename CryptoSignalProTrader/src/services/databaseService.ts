import * as SQLite from 'expo-sqlite';
import { DB_NAME } from '../utils/constants';
import { Trade } from '../types/trading';
import { Signal } from '../types/signals';
import { AppLog } from '../types/app';

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db = SQLite.openDatabase(DB_NAME, '1.0', 'CryptoSignal DB', 50 * 1024 * 1024, (database) => {
      database.exec(
        [
          { sql: 'PRAGMA journal_mode = WAL;', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, api_key_encrypted TEXT, api_secret_encrypted TEXT, is_testnet BOOLEAN DEFAULT 1, is_auto_trade BOOLEAN DEFAULT 0, is_paper_trade BOOLEAN DEFAULT 1, risk_level TEXT DEFAULT "moderate", max_trade_pct REAL DEFAULT 3.0, daily_loss_limit REAL DEFAULT 5.0, weekly_loss_limit REAL DEFAULT 10.0, max_drawdown_pct REAL DEFAULT 15.0, default_sl_pct REAL DEFAULT 2.0, default_tp_pct REAL DEFAULT 4.0, trailing_stop_pct REAL DEFAULT 1.5, cooldown_seconds INTEGER DEFAULT 300, max_daily_trades INTEGER DEFAULT 20, max_open_trades INTEGER DEFAULT 5, min_confidence INTEGER DEFAULT 70, strategy TEXT DEFAULT "moderate", telegram_bot_token TEXT, telegram_chat_id TEXT, auto_start_on_boot BOOLEAN DEFAULT 1, biometric_enabled BOOLEAN DEFAULT 0, pin_code TEXT, language TEXT DEFAULT "en", created_at TIMESTAMP, updated_at TIMESTAMP);', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT UNIQUE NOT NULL, is_active BOOLEAN DEFAULT 1, custom_sl REAL, custom_tp REAL, custom_qty_pct REAL, added_at TIMESTAMP);', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS signals (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, signal_type TEXT NOT NULL, score REAL NOT NULL, confidence REAL NOT NULL, market_regime TEXT, rsi_value REAL, macd_value REAL, macd_signal REAL, macd_histogram REAL, bb_upper REAL, bb_lower REAL, bb_percent REAL, ema9 REAL, ema21 REAL, ema50 REAL, stoch_rsi_k REAL, stoch_rsi_d REAL, atr_value REAL, adx_value REAL, volume_ratio REAL, timeframe TEXT, price_at_signal REAL, was_acted_on BOOLEAN DEFAULT 0, outcome TEXT, outcome_pnl REAL, created_at TIMESTAMP);', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY AUTOINCREMENT, binance_order_id TEXT, symbol TEXT NOT NULL, side TEXT NOT NULL, order_type TEXT NOT NULL, quantity REAL NOT NULL, entry_price REAL, exit_price REAL, total_value REAL, status TEXT DEFAULT "OPEN", stop_loss REAL, take_profit REAL, trailing_stop REAL, fee_paid REAL DEFAULT 0, gross_pnl REAL, net_pnl REAL, pnl_percentage REAL, signal_id INTEGER, strategy_used TEXT, is_paper_trade BOOLEAN DEFAULT 1, duration_seconds INTEGER, exit_reason TEXT, notes TEXT, opened_at TIMESTAMP, closed_at TIMESTAMP);', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS daily_performance (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT UNIQUE, total_trades INTEGER DEFAULT 0, winning_trades INTEGER DEFAULT 0, losing_trades INTEGER DEFAULT 0, gross_pnl REAL DEFAULT 0, net_pnl REAL DEFAULT 0, fees_paid REAL DEFAULT 0, max_drawdown REAL DEFAULT 0, portfolio_start REAL, portfolio_end REAL, best_trade REAL, worst_trade REAL);', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS engine_state (id INTEGER PRIMARY KEY AUTOINCREMENT, state_key TEXT UNIQUE, state_value TEXT, updated_at TIMESTAMP);', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS app_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT, message TEXT, details TEXT, created_at TIMESTAMP);', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, data TEXT, is_read BOOLEAN DEFAULT 0, created_at TIMESTAMP);', args: [] },
          { sql: 'CREATE TABLE IF NOT EXISTS price_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, condition TEXT NOT NULL, target_price REAL NOT NULL, is_active BOOLEAN DEFAULT 1, is_triggered BOOLEAN DEFAULT 0, created_at TIMESTAMP, triggered_at TIMESTAMP);', args: [] },
        ],
        false,
        (error) => {
          if (error) {
            console.error('DB init error:', error);
            reject(error);
          } else {
            console.log('Database initialized successfully');
            resolve();
          }
        }
      );
    });
  });
};

const executeSql = (sql: string, args: any[] = []): Promise<SQLite.ResultSet> => {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    db.transaction((tx) => {
      tx.executeSql(sql, args, (_, result) => resolve(result), (_, error) => { reject(error); return true; });
    });
  });
};

const readSql = (sql: string, args: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    db.readTransaction((tx) => {
      tx.executeSql(sql, args, (_, result) => {
        const rows: any[] = [];
        for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
        resolve(rows);
      }, (_, error) => { reject(error); return true; });
    });
  });
};

export const saveSetting = async (key: string, value: any): Promise<void> => {
  await executeSql('INSERT OR REPLACE INTO engine_state (state_key, state_value, updated_at) VALUES (?, ?, datetime("now"))', [key, JSON.stringify(value)]);
};

export const getSetting = async (key: string): Promise<any> => {
  const rows = await readSql('SELECT state_value FROM engine_state WHERE state_key = ?', [key]);
  return rows.length > 0 ? JSON.parse(rows[0].state_value) : null;
};

export const saveTrade = async (trade: Trade): Promise<void> => {
  await executeSql(
    'INSERT OR REPLACE INTO trades (id, binance_order_id, symbol, side, order_type, quantity, entry_price, exit_price, total_value, status, stop_loss, take_profit, trailing_stop, fee_paid, gross_pnl, net_pnl, pnl_percentage, signal_id, strategy_used, is_paper_trade, duration_seconds, exit_reason, notes, opened_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [trade.id, trade.binanceOrderId, trade.symbol, trade.side, trade.orderType, trade.quantity, trade.entryPrice, trade.exitPrice, trade.totalValue, trade.status, trade.stopLoss, trade.takeProfit, trade.trailingStop, trade.feePaid, trade.grossPnl, trade.netPnl, trade.pnlPercentage, trade.signalId, trade.strategyUsed, trade.isPaperTrade ? 1 : 0, trade.durationSeconds, trade.exitReason, trade.notes, trade.openedAt, trade.closedAt]
  );
};

export const getOpenTrades = async (): Promise<Trade[]> => {
  const rows = await readSql('SELECT * FROM trades WHERE status = ? ORDER BY opened_at DESC', ['OPEN']);
  return rows.map(mapRowToTrade);
};

export const getAllTrades = async (limit: number = 100): Promise<Trade[]> => {
  const rows = await readSql('SELECT * FROM trades ORDER BY opened_at DESC LIMIT ?', [limit]);
  return rows.map(mapRowToTrade);
};

export const getTradesByDateRange = async (startDate: string, endDate: string): Promise<Trade[]> => {
  const rows = await readSql('SELECT * FROM trades WHERE opened_at BETWEEN ? AND ? ORDER BY opened_at DESC', [startDate, endDate]);
  return rows.map(mapRowToTrade);
};

const mapRowToTrade = (row: any): Trade => ({
  id: row.id, binanceOrderId: row.binance_order_id, symbol: row.symbol, side: row.side,
  orderType: row.order_type, quantity: row.quantity, entryPrice: row.entry_price,
  exitPrice: row.exit_price, totalValue: row.total_value, status: row.status,
  stopLoss: row.stop_loss, takeProfit: row.take_profit, trailingStop: row.trailing_stop,
  trailingStopActivated: false, breakevenActivated: false, feePaid: row.fee_paid,
  grossPnl: row.gross_pnl, netPnl: row.net_pnl, pnlPercentage: row.pnl_percentage,
  signalId: row.signal_id, strategyUsed: row.strategy_used, isPaperTrade: row.is_paper_trade === 1,
  durationSeconds: row.duration_seconds, exitReason: row.exit_reason, notes: row.notes,
  openedAt: row.opened_at, closedAt: row.closed_at,
});

export const saveSignal = async (signal: Signal): Promise<void> => {
  await executeSql(
    'INSERT INTO signals (symbol, signal_type, score, confidence, market_regime, rsi_value, macd_value, macd_signal, macd_histogram, bb_upper, bb_lower, bb_percent, ema9, ema21, ema50, stoch_rsi_k, stoch_rsi_d, atr_value, adx_value, volume_ratio, timeframe, price_at_signal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))',
    [signal.symbol, signal.signalType, signal.score, signal.confidence, signal.marketRegime, signal.rsiValue, signal.macdValue, signal.macdSignal, signal.macdHistogram, signal.bbUpper, signal.bbLower, signal.bbPercent, signal.ema9, signal.ema21, signal.ema50, signal.stochRsiK, signal.stochRsiD, signal.atrValue, signal.adxValue, signal.volumeRatio, signal.timeframe, signal.priceAtSignal]
  );
};

export const getRecentSignals = async (limit: number = 50): Promise<Signal[]> => {
  const rows = await readSql('SELECT * FROM signals ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map(row => ({
    id: row.id, symbol: row.symbol, signalType: row.signal_type, score: row.score,
    confidence: row.confidence, marketRegime: row.market_regime, rsiValue: row.rsi_value,
    macdValue: row.macd_value, macdSignal: row.macd_signal, macdHistogram: row.macd_histogram,
    bbUpper: row.bb_upper, bbLower: row.bb_lower, bbPercent: row.bb_percent,
    ema9: row.ema9, ema21: row.ema21, ema50: row.ema50,
    stochRsiK: row.stoch_rsi_k, stochRsiD: row.stoch_rsi_d,
    atrValue: row.atr_value, adxValue: row.adx_value, volumeRatio: row.volume_ratio,
    timeframe: row.timeframe, priceAtSignal: row.price_at_signal,
    wasActedOn: row.was_acted_on === 1, outcome: row.outcome, outcomePnl: row.outcome_pnl,
    createdAt: row.created_at,
    multiTimeframeAlignment: { '1m': null, '5m': null, '15m': null, '1h': null, '4h': null, '1d': null, alignmentScore: 0, confirmingTimeframes: 0 },
  }));
};

export const saveEngineState = async (key: string, value: any): Promise<void> => {
  await executeSql('INSERT OR REPLACE INTO engine_state (state_key, state_value, updated_at) VALUES (?, ?, datetime("now"))', [key, JSON.stringify(value)]);
};

export const getEngineState = async (key: string): Promise<any> => {
  const rows = await readSql('SELECT state_value FROM engine_state WHERE state_key = ?', [key]);
  return rows.length > 0 ? JSON.parse(rows[0].state_value) : null;
};

export const addLog = async (level: string, message: string, details?: string): Promise<void> => {
  await executeSql('INSERT INTO app_logs (level, message, details, created_at) VALUES (?, ?, ?, datetime("now"))', [level, message, details || null]);
};

export const getLogs = async (limit: number = 100): Promise<AppLog[]> => {
  const rows = await readSql('SELECT * FROM app_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map(row => ({ id: row.id, level: row.level, message: row.message, details: row.details, createdAt: row.created_at }));
};

export const saveNotification = async (type: string, title: string, message: string, data?: any): Promise<void> => {
  await executeSql('INSERT INTO notifications (type, title, message, data, is_read, created_at) VALUES (?, ?, ?, ?, 0, datetime("now"))', [type, title, message, data ? JSON.stringify(data) : null]);
};

export const getNotifications = async (limit: number = 100): Promise<any[]> => {
  return readSql('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?', [limit]);
};

export const markNotificationRead = async (id: number): Promise<void> => {
  await executeSql('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const rows = await readSql('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');
  return rows.length > 0 ? rows[0].count : 0;
};

export const clearOldLogs = async (daysToKeep: number = 7): Promise<void> => {
  await executeSql(`DELETE FROM app_logs WHERE created_at < datetime('now', '-${daysToKeep} days')`);
};

export const getTradeCountForToday = async (): Promise<number> => {
  const rows = await readSql(`SELECT COUNT(*) as count FROM trades WHERE date(opened_at) = date('now')`);
  return rows.length > 0 ? rows[0].count : 0;
};

export const getDailyPnl = async (): Promise<number> => {
  const rows = await readSql(`SELECT COALESCE(SUM(net_pnl), 0) as total FROM trades WHERE date(closed_at) = date('now') AND status = 'CLOSED'`);
  return rows.length > 0 ? rows[0].total : 0;
};