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

const maxReconnectAttempts = 5;
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
  if (!shouldReconnect || reconnectAttempts >= maxReconnectAttempts) return;

  const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
  reconnectTimeout = setTimeout(() => {
    reconnectAttempts += 1;
    openSocket();
  }, delay);
};

const openSocket = () => {
  const token = getToken();
  const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL;

  if (!token || !wsBaseUrl) return;
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

      if (subscriberCount > 0) {
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

const subscribe = (handler) => {
  if (closeGraceTimeout) {
    clearTimeout(closeGraceTimeout);
    closeGraceTimeout = null;
  }

  subscribers.add(handler);
  subscriberCount += 1;
  shouldReconnect = true;
  openSocket();

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

const useWebSocket = (onMessage) => {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const handler = (data) => onMessageRef.current?.(data);
    return subscribe(handler);
  }, []);
};

export default useWebSocket;
