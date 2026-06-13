const WebSocket = require('ws');

const wsClients = new Map();
const pendingByUser = new Map();

const BUFFERABLE_TYPES = new Set(['qr', 'ready', 'disconnected']);

const bufferForUser = (userId, data) => {
  if (!BUFFERABLE_TYPES.has(data.type)) return;
  pendingByUser.set(userId.toString(), data);
};

const flushPendingForUser = (userId) => {
  const key = userId.toString();
  const pending = pendingByUser.get(key);
  if (!pending) return;

  const ws = wsClients.get(key);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(pending));
    console.log(`📤 Flushed buffered ${pending.type} message to user ${key}`);
    if (pending.type === 'ready') {
      pendingByUser.delete(key);
    }
  }
};

const setupWebSocket = (server, verifyToken, onUserConnected) => {
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

    if (typeof onUserConnected === 'function') {
      onUserConnected(userIdStr).catch((err) => {
        console.warn(`Post-connect WhatsApp recovery failed for ${userIdStr}: ${err.message}`);
      });
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
  const ws = wsClients.get(key);

  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log(`📤 WebSocket SEND to ${key}: ${data.type} (message size: ${JSON.stringify(data).length} bytes)`);
    ws.send(JSON.stringify(data));
    if (data.type === 'ready') {
      pendingByUser.delete(key);
    }
    return true;
  }

  if (BUFFERABLE_TYPES.has(data.type)) {
    bufferForUser(key, data);
    console.log(`📥 Buffered ${data.type} for user ${key} (WebSocket not ready)`);
  } else if (!ws) {
    console.warn(`⚠️  No WebSocket connection found for user ${key}`);
  } else {
    console.warn(`⚠️  WebSocket for ${key} not in OPEN state (readyState: ${ws.readyState})`);
  }

  return false;
};

const getWsClients = () => wsClients;

module.exports = { setupWebSocket, sendToUser, getWsClients, flushPendingForUser };
