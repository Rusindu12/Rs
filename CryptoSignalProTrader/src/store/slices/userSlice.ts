import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  isAuthenticated: boolean;
  isBiometricEnabled: boolean;
  isFirstLaunch: boolean;
  isPinSet: boolean;
  lastAuthTime: number | null;
}

const initialState: UserState = {
  isAuthenticated: false,
  isBiometricEnabled: false,
  isFirstLaunch: true,
  isPinSet: false,
  lastAuthTime: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
      if (action.payload) state.lastAuthTime = Date.now();
    },
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.isBiometricEnabled = action.payload;
    },
    setFirstLaunchComplete: (state) => {
      state.isFirstLaunch = false;
    },
    setPinSet: (state, action: PayloadAction<boolean>) => {
      state.isPinSet = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.lastAuthTime = null;
    },
  },
});

export const { setAuthenticated, setBiometricEnabled, setFirstLaunchComplete, setPinSet, logout } = userSlice.actions;
export default userSlice.reducer;
