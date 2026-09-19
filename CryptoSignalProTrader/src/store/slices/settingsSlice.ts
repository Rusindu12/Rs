import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppSettings, AppLanguage, TradingStrategy } from '../../types/app';

const defaultSettings: AppSettings = {
  id: 1,
  apiKeyEncrypted: null,
  apiSecretEncrypted: null,
  isTestnet: true,
  isAutoTrade: false,
  isPaperTrade: true,
  riskLevel: 'moderate',
  maxTradePct: 3.0,
  dailyLossLimit: 5.0,
  weeklyLossLimit: 10.0,
  maxDrawdownPct: 15.0,
  defaultSlPct: 2.0,
  defaultTpPct: 4.0,
  trailingStopPct: 1.5,
  cooldownSeconds: 300,
  maxDailyTrades: 20,
  maxOpenTrades: 5,
  minConfidence: 70,
  strategy: 'moderate',
  telegramBotToken: null,
  telegramChatId: null,
  autoStartOnBoot: true,
  biometricEnabled: false,
  pinCode: null,
  language: 'en',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
}

const initialState: SettingsState = {
  settings: defaultSettings,
  isLoaded: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    loadSettings: (state, action: PayloadAction<Partial<AppSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
      state.isLoaded = true;
    },
    updateSettings: (state, action: PayloadAction<Partial<AppSettings>>) => {
      state.settings = { ...state.settings, ...action.payload, updatedAt: new Date().toISOString() };
    },
    setTestnet: (state, action: PayloadAction<boolean>) => {
      state.settings.isTestnet = action.payload;
      state.settings.updatedAt = new Date().toISOString();
    },
    setAutoTrade: (state, action: PayloadAction<boolean>) => {
      state.settings.isAutoTrade = action.payload;
      state.settings.updatedAt = new Date().toISOString();
    },
    setPaperTrade: (state, action: PayloadAction<boolean>) => {
      state.settings.isPaperTrade = action.payload;
      state.settings.updatedAt = new Date().toISOString();
    },
    setStrategy: (state, action: PayloadAction<TradingStrategy>) => {
      state.settings.strategy = action.payload;
      state.settings.updatedAt = new Date().toISOString();
    },
    setLanguage: (state, action: PayloadAction<AppLanguage>) => {
      state.settings.language = action.payload;
      state.settings.updatedAt = new Date().toISOString();
    },
    setApiConfigured: (state, action: PayloadAction<boolean>) => {
      if (action.payload) {
        state.settings.apiKeyEncrypted = 'configured';
        state.settings.apiSecretEncrypted = 'configured';
      } else {
        state.settings.apiKeyEncrypted = null;
        state.settings.apiSecretEncrypted = null;
      }
      state.settings.updatedAt = new Date().toISOString();
    },
  },
});

export const {
  loadSettings, updateSettings, setTestnet, setAutoTrade,
  setPaperTrade, setStrategy, setLanguage, setApiConfigured,
} = settingsSlice.actions;
export default settingsSlice.reducer;
