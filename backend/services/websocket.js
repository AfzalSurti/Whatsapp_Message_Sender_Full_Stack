const WebSocket = require('ws');

// ─── WEBSOCKET STORE ──────────────────────────────────────────
// Stores active WebSocket connections per user
// Key: userId (string), Value: WebSocket connection
const wsClients = new Map();

// ─── SETUP WEBSOCKET SERVER ───────────────────────────────────
// Attaches WebSocket server to existing Express HTTP server
const setupWebSocket = (server, verifyToken) => {

  // Create WebSocket server on same port as Express
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    console.log('🔌 New WebSocket connection attempt');

    // ── AUTHENTICATE ────────────────────────────────────────
    // Token comes in URL query: ws://localhost:5000?token=xxx
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', message: 'No token provided' }));
      ws.close();
      return;
    }

    // Verify JWT token
    let userId;
    try {
      userId = verifyToken(token); // returns userId from token
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
      ws.close();
      return;
    }

    // Store WebSocket connection for this user
    wsClients.set(userId, ws);
    console.log(`✅ WebSocket connected for user: ${userId}`);

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket ready' }));

    // ── HANDLE MESSAGES FROM FRONTEND ───────────────────────
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        console.log(`📨 Message from ${userId}:`, msg);
        // Handle frontend messages if needed later
      } catch (err) {
        console.error('Invalid WebSocket message:', err.message);
      }
    });

    // ── HANDLE DISCONNECT ────────────────────────────────────
    ws.on('close', () => {
      wsClients.delete(userId);
      console.log(`👋 WebSocket disconnected for user: ${userId}`);
    });

    // ── HANDLE ERRORS ────────────────────────────────────────
    ws.on('error', (err) => {
      console.error(`WebSocket error for ${userId}:`, err.message);
      wsClients.delete(userId);
    });
  });

  console.log('🔌 WebSocket server ready');
  return wss;
};

// ─── SEND TO USER ─────────────────────────────────────────────
// Send a message to a specific user's WebSocket
const sendToUser = (userId, data) => {
  const ws = wsClients.get(userId.toString());

  // Check connection is open (readyState 1 = OPEN)
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log(`📤 WebSocket SEND to ${userId}: ${data.type} (message size: ${JSON.stringify(data).length} bytes)`);
    ws.send(JSON.stringify(data));
    return true;
  }

  if (!ws) {
    console.warn(`⚠️  No WebSocket connection found for user ${userId}`);
  } else {
    console.warn(`⚠️  WebSocket for ${userId} not in OPEN state (readyState: ${ws.readyState})`);
  }
  return false; // user not connected
};

// ─── GET WS CLIENTS MAP ───────────────────────────────────────
const getWsClients = () => wsClients;

module.exports = { setupWebSocket, sendToUser, getWsClients };