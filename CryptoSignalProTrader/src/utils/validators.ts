export const validateApiKey = (key: string): { valid: boolean; error: string } => {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }
  if (key.length < 30) {
    return { valid: false, error: 'API key appears too short' };
  }
  if (key.length > 100) {
    return { valid: false, error: 'API key appears too long' };
  }
  if (!/^[A-Za-z0-9]+$/.test(key)) {
    return { valid: false, error: 'API key contains invalid characters' };
  }
  return { valid: true, error: '' };
};

export const validateApiSecret = (secret: string): { valid: boolean; error: string } => {
  if (!secret || secret.trim().length === 0) {
    return { valid: false, error: 'API secret is required' };
  }
  if (secret.length < 30) {
    return { valid: false, error: 'API secret appears too short' };
  }
  if (secret.length > 100) {
    return { valid: false, error: 'API secret appears too long' };
  }
  if (!/^[A-Za-z0-9]+$/.test(secret)) {
    return { valid: false, error: 'API secret contains invalid characters' };
  }
  return { valid: true, error: '' };
};

export const validatePin = (pin: string): { valid: boolean; error: string } => {
  if (!pin || pin.length !== 6) {
    return { valid: false, error: 'PIN must be 6 digits' };
  }
  if (!/^\d{6}$/.test(pin)) {
    return { valid: false, error: 'PIN must contain only numbers' };
  }
  return { valid: true, error: '' };
};

export const validateTradeAmount = (
  amount: number,
  balance: number,
  maxPct: number
): { valid: boolean; error: string } => {
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }
  const maxAmount = (balance * maxPct) / 100;
  if (amount > maxAmount) {
    return { valid: false, error: `Amount exceeds ${maxPct}% of balance ($${maxAmount.toFixed(2)})` };
  }
  if (amount > balance) {
    return { valid: false, error: 'Insufficient balance' };
  }
  return { valid: true, error: '' };
};

export const validatePrice = (price: number): { valid: boolean; error: string } => {
  if (price <= 0) {
    return { valid: false, error: 'Price must be greater than 0' };
  }
  if (!isFinite(price)) {
    return { valid: false, error: 'Price must be a finite number' };
  }
  return { valid: true, error: '' };
};

export const validateStopLoss = (
  entryPrice: number,
  stopLoss: number,
  side: 'BUY' | 'SELL'
): { valid: boolean; error: string } => {
  if (stopLoss <= 0) {
    return { valid: false, error: 'Stop loss must be greater than 0' };
  }
  if (side === 'BUY' && stopLoss >= entryPrice) {
    return { valid: false, error: 'Buy stop loss must be below entry price' };
  }
  if (side === 'SELL' && stopLoss <= entryPrice) {
    return { valid: false, error: 'Sell stop loss must be above entry price' };
  }
  return { valid: true, error: '' };
};

export const validateTakeProfit = (
  entryPrice: number,
  takeProfit: number,
  side: 'BUY' | 'SELL'
): { valid: boolean; error: string } => {
  if (takeProfit <= 0) {
    return { valid: false, error: 'Take profit must be greater than 0' };
  }
  if (side === 'BUY' && takeProfit <= entryPrice) {
    return { valid: false, error: 'Buy take profit must be above entry price' };
  }
  if (side === 'SELL' && takeProfit >= entryPrice) {
    return { valid: false, error: 'Sell take profit must be below entry price' };
  }
  return { valid: true, error: '' };
};

export const validateTelegramToken = (token: string): { valid: boolean; error: string } => {
  if (!token) return { valid: true, error: '' };
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return { valid: false, error: 'Invalid Telegram bot token format' };
  }
  return { valid: true, error: '' };
};

export const validateTelegramChatId = (chatId: string): { valid: boolean; error: string } => {
  if (!chatId) return { valid: true, error: '' };
  if (!/^-?\d+$/.test(chatId)) {
    return { valid: false, error: 'Invalid Telegram chat ID' };
  }
  return { valid: true, error: '' };
};

export const isValidSymbol = (symbol: string): boolean => {
  return /^[A-Z]{2,10}(USDT|BUSD|USDC|BTC|ETH|BNB)$/.test(symbol);
};

export const sanitizeInput = (input: string): string => {
  return input.replace(/[<>'"&]/g, '');
};
