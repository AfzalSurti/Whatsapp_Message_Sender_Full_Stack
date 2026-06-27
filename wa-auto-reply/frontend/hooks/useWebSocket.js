import { useEffect, useRef, useCallback } from 'react';
import { getToken } from '@/lib/auth';

const useWebSocket = (onMessage) => {
  const ws = useRef(null);
  const connectRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 2000;
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    const token = getToken();
    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL;

    if (!token) {
      return;
    }

    if (!wsBaseUrl) {
      console.warn('NEXT_PUBLIC_WS_URL is not set. WebSocket disabled.');
      return;
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      return;
    }

    if (ws.current) {
      intentionalCloseRef.current = true;
      ws.current.close();
      ws.current = null;
    }

    try {
      const wsUrl = `${wsBaseUrl}?token=${token}`;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessageRef.current?.(data);
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.current.onclose = () => {
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false;
          return;
        }

        if (shouldReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectRef.current?.();
          }, delay);
        }
      };

      ws.current.onerror = () => {
        // Browser fires this when the socket cannot connect or drops abruptly.
        // Details come from onclose; avoid noisy [object Event] logs in dev.
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (ws.current) {
      intentionalCloseRef.current = true;
      ws.current.close();
      ws.current = null;
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

