import { useEffect, useRef, useCallback } from 'react';
import { getToken } from '@/lib/auth';

const useWebSocket = (onMessage) => {
  const ws = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 2000;

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      console.warn('No auth token available for WebSocket');
      return;
    }

    try {
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`;
      console.log('Connecting to WebSocket:', wsUrl.replace(/token=.*/, 'token=***'));

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('✅ WebSocket connected');
        reconnectAttempts = 0;
      };

      ws.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessage(data);
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.current.onclose = () => {
        console.log('👋 WebSocket disconnected');
        if (shouldReconnectRef.current && reconnectAttempts < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, delay);
        }
      };

      ws.current.onerror = (err) => {
        console.error('❌ WebSocket error:', err);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }, [onMessage]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (ws.current) {
      ws.current.close();
    }
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connect, disconnect };
};

export default useWebSocket;

