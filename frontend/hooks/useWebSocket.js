import { useEffect, useRef } from 'react';
import { getToken } from '@/lib/auth';

const subscribers = new Set();
let ws = null;
let subscriberCount = 0;
let reconnectTimeout = null;
let closeGraceTimeout = null;
let reconnectAttempts = 0;
let shouldReconnect = true;
let intentionalClose = false;
let connectEnabled = false;

const maxReconnectAttempts = 8;
const baseReconnectDelay = 2000;
const CLOSE_GRACE_MS = 150;

const notifySubscribers = (data) => {
  subscribers.forEach((handler) => {
    try {
      handler(data);
    } catch (err) {
      console.error('WebSocket subscriber error:', err);
    }
  });
};

const scheduleReconnect = () => {
  if (!shouldReconnect || !connectEnabled || reconnectAttempts >= maxReconnectAttempts) return;

  const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
  reconnectTimeout = setTimeout(() => {
    reconnectAttempts += 1;
    openSocket();
  }, delay);
};

const openSocket = () => {
  const token = getToken();
  const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL;

  if (!connectEnabled || !token) return;

  if (!wsBaseUrl) {
    console.warn('NEXT_PUBLIC_WS_URL is not set. WebSocket disabled.');
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  if (ws) {
    intentionalClose = true;
    ws.close();
    ws = null;
  }

  try {
    ws = new WebSocket(`${wsBaseUrl}?token=${token}`);

    ws.onopen = () => {
      reconnectAttempts = 0;
      if (process.env.NODE_ENV === 'development') {
        console.log('WebSocket connected');
      }
    };

    ws.onmessage = (event) => {
      try {
        notifySubscribers(JSON.parse(event.data));
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.onclose = () => {
      ws = null;
      if (intentionalClose) {
        intentionalClose = false;
        return;
      }

      if (subscriberCount > 0 && connectEnabled) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // Details are handled in onclose.
    };
  } catch (err) {
    console.error('WebSocket connection error:', err);
  }
};

const closeSocket = () => {
  shouldReconnect = false;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (ws) {
    intentionalClose = true;
    ws.close();
    ws = null;
  }
};

const setConnectEnabled = (enabled) => {
  connectEnabled = enabled;
  if (enabled) {
    shouldReconnect = true;
    reconnectAttempts = 0;
    if (subscriberCount > 0) {
      openSocket();
    }
    return;
  }

  closeSocket();
};

const subscribe = (handler) => {
  if (closeGraceTimeout) {
    clearTimeout(closeGraceTimeout);
    closeGraceTimeout = null;
  }

  subscribers.add(handler);
  subscriberCount += 1;
  shouldReconnect = true;

  if (connectEnabled) {
    openSocket();
  }

  return () => {
    subscribers.delete(handler);
    subscriberCount = Math.max(0, subscriberCount - 1);

    if (subscriberCount === 0) {
      closeGraceTimeout = setTimeout(() => {
        if (subscriberCount === 0) {
          closeSocket();
        }
      }, CLOSE_GRACE_MS);
    }
  };
};

const useWebSocket = (onMessage, enabled = true) => {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    setConnectEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    const handler = (data) => onMessageRef.current?.(data);
    return subscribe(handler);
  }, []);
};

export default useWebSocket;
