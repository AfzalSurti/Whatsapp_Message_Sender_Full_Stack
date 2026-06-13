const WebSocket = require('ws');

const wsClients = new Map();
const pendingByUser = new Map();
const latestQrByUser = new Map();
const flushRetryTimers = new Map();

const BUFFERABLE_TYPES = new Set(['qr', 'ready', 'disconnected']);
const FLUSH_RETRY_MS = 1000;
const FLUSH_RETRY_MAX = 30;

const bufferForUser = (userId, data) => {
  if (!BUFFERABLE_TYPES.has(data.type)) return;
  pendingByUser.set(userId.toString(), data);
};

const flushPendingForUser = (userId) => {
  const key = userId.toString();
  const pending = pendingByUser.get(key);
  if (!pending) return false;

  const ws = wsClients.get(key);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(pending));
    console.log(`📤 Flushed buffered ${pending.type} message to user ${key}`);
    if (pending.type === 'ready' || pending.type === 'disconnected') {
      pendingByUser.delete(key);
    }
    return true;
  }

  return false;
};

const stopFlushRetry = (userId) => {
  const key = userId.toString();
  const timer = flushRetryTimers.get(key);
  if (timer) {
    clearInterval(timer);
    flushRetryTimers.delete(key);
  }
};

const scheduleFlushRetry = (userId) => {
  const key = userId.toString();
  if (flushRetryTimers.has(key)) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;

    if (flushPendingForUser(key)) {
      stopFlushRetry(key);
      return;
    }

    if (attempts >= FLUSH_RETRY_MAX) {
      stopFlushRetry(key);
    }
  }, FLUSH_RETRY_MS);

  flushRetryTimers.set(key, timer);
};

const setupWebSocket = (server, verifyToken) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    console.log('🔌 New WebSocket connection attempt');

    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', message: 'No token provided' }));
      ws.close();
      return;
    }

    let userId;
    try {
      userId = verifyToken(token);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
      ws.close();
      return;
    }

    const userIdStr = userId.toString();
    wsClients.set(userIdStr, ws);
    console.log(`✅ WebSocket connected for user: ${userIdStr}`);

    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket ready' }));
    flushPendingForUser(userIdStr);

    const latestQr = latestQrByUser.get(userIdStr);
    if (latestQr) {
      ws.send(JSON.stringify({ type: 'qr', qr: latestQr }));
      console.log(`📤 Re-sent latest QR to reconnected user ${userIdStr}`);
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        console.log(`📨 Message from ${userIdStr}:`, msg);
      } catch (err) {
        console.error('Invalid WebSocket message:', err.message);
      }
    });

    ws.on('close', () => {
      wsClients.delete(userIdStr);
      console.log(`👋 WebSocket disconnected for user: ${userIdStr}`);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${userIdStr}:`, err.message);
      wsClients.delete(userIdStr);
    });
  });

  console.log('🔌 WebSocket server ready');
  return wss;
};

const sendToUser = (userId, data) => {
  const key = userId.toString();

  if (data.type === 'qr' && data.qr) {
    latestQrByUser.set(key, data.qr);
  }

  if (data.type === 'ready') {
    latestQrByUser.delete(key);
    pendingByUser.delete(key);
    stopFlushRetry(key);
  }

  if (data.type === 'disconnected') {
    pendingByUser.delete(key);
  }

  const ws = wsClients.get(key);

  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log(`📤 WebSocket SEND to ${key}: ${data.type} (message size: ${JSON.stringify(data).length} bytes)`);
    ws.send(JSON.stringify(data));
    return true;
  }

  if (BUFFERABLE_TYPES.has(data.type)) {
    bufferForUser(key, data);
    console.log(`📥 Buffered ${data.type} for user ${key} (WebSocket not ready)`);
    scheduleFlushRetry(key);
  } else if (!ws) {
    console.warn(`⚠️  No WebSocket connection found for user ${key}`);
  } else {
    console.warn(`⚠️  WebSocket for ${key} not in OPEN state (readyState: ${ws.readyState})`);
  }

  return false;
};

const getLatestQr = (userId) => latestQrByUser.get(userId.toString()) || null;

const clearLatestQr = (userId) => {
  const key = userId.toString();
  latestQrByUser.delete(key);
  pendingByUser.delete(key);
  stopFlushRetry(key);
};

const getWsClients = () => wsClients;

module.exports = {
  setupWebSocket,
  sendToUser,
  getWsClients,
  flushPendingForUser,
  getLatestQr,
  clearLatestQr
};
