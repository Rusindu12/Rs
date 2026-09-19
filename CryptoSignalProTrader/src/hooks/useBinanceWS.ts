import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { updatePrice, setConnectionStatus } from '../store/slices/marketSlice';
import { binanceWs, WsEvent } from '../api/binanceWebSocket';
import { WS_STREAMS } from '../api/endpoints';

export const useBinanceWS = () => {
  const dispatch = useAppDispatch();
  const { selectedSymbol } = useAppSelector(state => state.market);
  const { isTestnet } = useAppSelector(state => state.settings.settings);
  const unsubscribers = useRef<(() => void)[]>([]);

  useEffect(() => {
    binanceWs.configure(isTestnet);
    const streams = [
      WS_STREAMS.ticker(selectedSymbol),
      WS_STREAMS.kline(selectedSymbol, '5m'),
      WS_STREAMS.kline(selectedSymbol, '15m'),
      WS_STREAMS.kline(selectedSymbol, '1h'),
    ];
    binanceWs.connect(streams);

    const unsubTicker = binanceWs.on('ticker', (event: WsEvent) => {
      if (event.data) {
        dispatch(updatePrice({
          symbol: event.data.s,
          price: parseFloat(event.data.c),
          change24h: parseFloat(event.data.P),
          volume24h: parseFloat(event.data.v),
          high24h: parseFloat(event.data.h),
          low24h: parseFloat(event.data.l),
          lastUpdate: Date.now(),
        }));
      }
    });

    const unsubConnected = binanceWs.on('connected', () => {
      dispatch(setConnectionStatus('connected'));
    });

    const unsubDisconnected = binanceWs.on('disconnected', () => {
      dispatch(setConnectionStatus('disconnected'));
    });

    unsubscribers.current = [unsubTicker, unsubConnected, unsubDisconnected];

    return () => {
      unsubscribers.current.forEach(unsub => unsub());
      binanceWs.disconnect();
    };
  }, [selectedSymbol, isTestnet, dispatch]);

  const subscribe = useCallback((stream: string) => {
    binanceWs.addStream(stream);
  }, []);

  const unsubscribe = useCallback((stream: string) => {
    binanceWs.removeStream(stream);
  }, []);

  const reconnect = useCallback(() => {
    binanceWs.reconnect();
  }, []);

  return { subscribe, unsubscribe, reconnect, connectionState: binanceWs.getConnectionState() };
};
