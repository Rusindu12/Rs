import { create } from 'zustand';
import type { Environment } from '../config';
import type { StoredCredentials, SecuritySettings } from '../services/secureVault';

export type RestStatus = 'unknown' | 'ok' | 'fail';

interface AuthState {
  hydrated: boolean;
  credentials: StoredCredentials | null;
  environment: Environment;
  restStatus: RestStatus;
  restError: string | null;
  wsConnected: boolean;
  locked: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  liveConfirmed: boolean;

  setHydrated: (v: boolean) => void;
  setCredentials: (c: StoredCredentials | null) => void;
  setEnvironment: (e: Environment) => void;
  setRestStatus: (s: RestStatus, error?: string | null) => void;
  setWsConnected: (v: boolean) => void;
  setLocked: (v: boolean) => void;
  setBiometricAvailable: (v: boolean) => void;
  setBiometricEnabled: (v: boolean) => void;
  setLiveConfirmed: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  hydrated: false,
  credentials: null,
  environment: 'testnet',
  restStatus: 'unknown',
  restError: null,
  wsConnected: false,
  locked: false,
  biometricAvailable: false,
  biometricEnabled: false,
  liveConfirmed: false,

  setHydrated: (v) => set({ hydrated: v }),
  setCredentials: (c) =>
    set({ credentials: c, environment: c?.environment ?? 'testnet' }),
  setEnvironment: (environment) => set({ environment }),
  setRestStatus: (restStatus, restError = null) => set({ restStatus, restError }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setLocked: (locked) => set({ locked }),
  setBiometricAvailable: (biometricAvailable) => set({ biometricAvailable }),
  setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
  setLiveConfirmed: (liveConfirmed) => set({ liveConfirmed }),
}));
