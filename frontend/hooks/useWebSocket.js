import { useEffect, useRef, useCallback } from 'react';
import { getToken } from '@/lib/auth';

const useWebSocket = (onMessage) => {
  const ws = useRef(null);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    // Connect with token in URL
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessage(data); // pass to component
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.current.onclose = () => {
      console.log('👋 WebSocket disconnected');
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, [onMessage]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
    }
  }, []);

  // Auto connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connect, disconnect };
};

export default useWebSocket;

