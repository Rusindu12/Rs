import { ENVIRONMENTS, type Environment } from '../../config';

export interface MiniTicker {
  symbol: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
}

/**
 * Binance websocket market streams.
 *
 * Uses the combined all-market mini-ticker stream (`!miniTicker@arr`) — a
 * single socket carrying every symbol, filtered client-side to our list.
 */
export class MarketStreams {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = 1000;
  private closedByUser = false;
  private lastMessageAt = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor(
    private env: Environment,
    private onTickers: (tickers: MiniTicker[]) => void,
    private onStatus: (connected: boolean) => void
  ) {}

  start(): void {
    this.closedByUser = false;
    this.connect();
    this.watchdog = setInterval(() => {
      // Binance sends a ping every 20s even on quiet streams; reconnect if silent.
      if (this.ws && Date.now() - this.lastMessageAt > 60_000) {
        this.teardownSocket();
        this.connect();
      }
    }, 30_000);
  }

  stop(): void {
    this.closedByUser = true;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.teardownSocket();
    this.onStatus(false);
  }

  setEnv(env: Environment) {
    if (env !== this.env) {
      this.env = env;
      if (!this.closedByUser) {
        this.teardownSocket();
        this.reconnectDelayMs = 1000;
        this.connect();
      }
    }
  }

  private teardownSocket(): void {
    if (this.ws) {
      try {
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        /* noop */
      }
      this.ws = null;
    }
  }

  private wsHostIndex = 0;
  private static WS_HOSTS: string[] = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision:9443'];

  private connect(): void {
    const hosts = this.env === 'live' ? MarketStreams.WS_HOSTS : [ENVIRONMENTS[this.env].wsBase];
    const base = hosts[this.wsHostIndex % hosts.length];
    const url = `${base}/stream?streams=!miniTicker@arr`;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.reconnectDelayMs = 1000;
        this.lastMessageAt = Date.now();
        this.onStatus(true);
      };
      this.wsHostIndex = 0; // healthy host stays first
      ws.onmessage = (ev: WebSocketMessageEvent) => {
        this.lastMessageAt = Date.now();
        try {
          const parsed = JSON.parse(String(ev.data)) as { stream: string; data: RawMiniTicker[] };
          if (parsed?.stream?.includes('miniTicker') && Array.isArray(parsed.data)) {
            this.onTickers(parsed.data.map(mapMiniTicker));
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onerror = () => {
        this.onStatus(false);
      };
      ws.onclose = () => {
        this.onStatus(false);
        if (!this.closedByUser) {
          if (hosts.length > 1) this.wsHostIndex++; // rotate to the mirror host
          this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelayMs);
          this.reconnectDelayMs = Math.min(30_000, this.reconnectDelayMs * 2);
        }
      };
    } catch {
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelayMs);
    }
  }
}

interface RawMiniTicker {
  s: string;
  c: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
}

function mapMiniTicker(t: RawMiniTicker): MiniTicker {
  return {
    symbol: t.s,
    close: Number(t.c),
    open: Number(t.o),
    high: Number(t.h),
    low: Number(t.l),
    volume: Number(t.v),
    quoteVolume: Number(t.q),
  };
}
