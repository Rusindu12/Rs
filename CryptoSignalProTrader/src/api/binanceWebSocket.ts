import { getWsBaseUrl, buildStreamUrl, WS_STREAMS } from './endpoints';
import { WS_HEARTBEAT_INTERVAL, WS_RECONNECT_DELAYS } from '../utils/constants';
import {
  BinanceWsTicker,
  BinanceWsKline,
  BinanceWsTrade,
  BinanceWsMiniTicker,
  BinanceWsDepth,
} from '../types/binance';

export type WsEventType = 'ticker' | 'kline' | 'trade' | 'depth' | 'miniTicker' | 'allMiniTickers' | 'error' | 'connected' | 'disconnected';

export interface WsEvent {
  type: WsEventType;
  data: any;
  symbol?: string;
  timestamp: number;
}

type WsEventHandler = (event: WsEvent) => void;

class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private isTestnet: boolean = true;
  private streams: string[] = [];
  private reconnectAttempt: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isConnected: boolean = false;
  private listeners: Map<string, Set<WsEventHandler>> = new Map();
  private messageBuffer: WsEvent[] = [];
  private maxBufferSize: number = 1000;
  private lastMessageTime: number = 0;
  private connectionId: number = 0;

  configure(isTestnet: boolean): void {
    this.isTestnet = isTestnet;
  }

  connect(streams: string[]): void {
    this.streams = streams;
    this.connectionId++;
    this.reconnectAttempt = 0;
    this.createConnection();
  }

  private createConnection(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    const url = buildStreamUrl(this.isTestnet, this.streams);
    console.log(`[WS] Connecting to: ${url} (attempt ${this.reconnectAttempt + 1})`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.isConnected = true;
        this.reconnectAttempt = 0;
        this.startHeartbeat();
        this.emit({ type: 'connected', data: { streams: this.streams }, timestamp: Date.now() });
      };

      this.ws.onmessage = (event) => {
        this.lastMessageTime = Date.now();
        try {
          const parsed = JSON.parse(event.data);
          this.processMessage(parsed);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.emit({ type: 'error', data: { message: 'WebSocket error', error }, timestamp: Date.now() });
      };

      this.ws.onclose = (event) => {
        console.log(`[WS] Closed: code=${event.code} reason=${event.reason}`);
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit({ type: 'disconnected', data: { code: event.code, reason: event.reason }, timestamp: Date.now() });
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[WS] Connection failed:', error);
      this.scheduleReconnect();
    }
  }

  private processMessage(data: any): void {
    if (data.stream) {
      const streamName = data.stream;
      const payload = data.data;

      if (streamName.includes('@ticker')) {
        this.emit({
          type: 'ticker',
          data: payload as BinanceWsTicker,
          symbol: payload.s,
          timestamp: Date.now(),
        });
      } else if (streamName.includes('@kline_')) {
        const klineEvent: WsEvent = {
          type: 'kline',
          data: payload.k as BinanceWsKline['k'],
          symbol: payload.s,
          timestamp: Date.now(),
        };
        this.emit(klineEvent);
      } else if (streamName.includes('@trade')) {
        this.emit({
          type: 'trade',
          data: payload as BinanceWsTrade,
          symbol: payload.s,
          timestamp: Date.now(),
        });
      } else if (streamName.includes('@depth')) {
        this.emit({
          type: 'depth',
          data: payload as BinanceWsDepth,
          symbol: payload.s,
          timestamp: Date.now(),
        });
      } else if (streamName.includes('@miniTicker')) {
        this.emit({
          type: 'miniTicker',
          data: payload as BinanceWsMiniTicker,
          symbol: payload.s,
          timestamp: Date.now(),
        });
      }
    } else if (Array.isArray(data)) {
      this.emit({
        type: 'allMiniTickers',
        data: data as BinanceWsMiniTicker[],
        timestamp: Date.now(),
      });
    }
  }

  private emit(event: WsEvent): void {
    this.messageBuffer.push(event);
    if (this.messageBuffer.length > this.maxBufferSize) {
      this.messageBuffer = this.messageBuffer.slice(-this.maxBufferSize);
    }

    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (e) {
          console.error(`[WS] Handler error for ${event.type}:`, e);
        }
      });
    }

    const allHandlers = this.listeners.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (e) {
          console.error('[WS] Wildcard handler error:', e);
        }
      });
    }
  }

  on(eventType: WsEventType | '*', handler: WsEventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      const handlers = this.listeners.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  off(eventType: WsEventType | '*', handler: WsEventHandler): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  updateStreams(streams: string[]): void {
    this.streams = streams;
    if (this.isConnected) {
      this.disconnect();
      setTimeout(() => this.createConnection(), 1000);
    }
  }

  addStream(stream: string): void {
    if (!this.streams.includes(stream)) {
      this.streams.push(stream);
      if (this.isConnected) {
        this.updateStreams(this.streams);
      }
    }
  }

  removeStream(stream: string): void {
    this.streams = this.streams.filter(s => s !== stream);
    if (this.isConnected) {
      this.updateStreams(this.streams);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {}
      }

      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      if (timeSinceLastMessage > WS_HEARTBEAT_INTERVAL * 3 && this.lastMessageTime > 0) {
        console.warn('[WS] No messages received in a while, reconnecting...');
        this.reconnect();
      }
    }, WS_HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = WS_RECONNECT_DELAYS[Math.min(this.reconnectAttempt, WS_RECONNECT_DELAYS.length - 1)];
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      this.createConnection();
    }, delay);
  }

  reconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempt = 0;
    this.createConnection();
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (this.isConnected) return 'connected';
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return 'connecting';
    return 'disconnected';
  }

  getBufferedMessages(type?: WsEventType): WsEvent[] {
    if (type) return this.messageBuffer.filter(e => e.type === type);
    return [...this.messageBuffer];
  }

  clearBuffer(): void {
    this.messageBuffer = [];
  }
}

export const binanceWs = new BinanceWebSocketClient();
export default BinanceWebSocketClient;
