export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

export const getTimestampMs = (): number => {
  return Date.now();
};

export const formatTime = (date: Date | string | number): string => {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const formatDate = (date: Date | string | number): string => {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatDateTime = (date: Date | string | number): string => {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getTimeDifference = (start: string | number, end: string | number): number => {
  const s = typeof start === 'string' ? new Date(start).getTime() : start;
  const e = typeof end === 'string' ? new Date(end).getTime() : end;
  return Math.abs(e - s);
};

export const isWithinTimeRange = (
  timestamp: string | number,
  rangeMs: number
): boolean => {
  const t = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  return Date.now() - t <= rangeMs;
};

export const getDateRange = (
  startDate: string,
  endDate: string
): string[] => {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const isTradingHours = (
  startHour: number = 0,
  endHour: number = 24,
  timezone: string = 'UTC'
): boolean => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', timeZone: timezone, hour12: false };
  const currentHour = parseInt(now.toLocaleString('en-US', options));
  return currentHour >= startHour && currentHour < endHour;
};

export const getDayOfWeek = (): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
};

export const secondsToHumanReadable = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
};

export const msToMinutes = (ms: number): number => {
  return Math.floor(ms / 60000);
};

export const msToHours = (ms: number): number => {
  return Math.floor(ms / 3600000);
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const subtractDays = (date: Date, days: number): Date => {
  return addDays(date, -days);
};

export const startOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const isToday = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

export const getIntervalMs = (interval: string): number => {
  const map: Record<string, number> = {
    '1m': 60000,
    '3m': 180000,
    '5m': 300000,
    '15m': 900000,
    '30m': 1800000,
    '1h': 3600000,
    '2h': 7200000,
    '4h': 14400000,
    '6h': 21600000,
    '8h': 28800000,
    '12h': 43200000,
    '1d': 86400000,
    '3d': 259200000,
    '1w': 604800000,
    '1M': 2592000000,
  };
  return map[interval] || 60000;
};
