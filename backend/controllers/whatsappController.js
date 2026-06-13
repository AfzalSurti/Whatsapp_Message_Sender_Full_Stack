const clientManager = require('../services/clientManager');
const { sendMessages } = require('../services/sender');
const Session = require('../models/Session');
const { trackUsage } = require('./keysController');
const { getLatestQr, clearLatestQr } = require('../services/websocket');

const connectWhatsApp = async (req, res) => {
  try {
    const userId = req.user._id;
    const userIdStr = userId.toString();
    const sendToUser = req.app.get('sendToUser');
    const status = clientManager.getStatus(userId);
    const explicitFresh = req.body?.fresh === true;

    if (status === 'connected') {
      return res.json({ message: 'Already connected', status: 'connected' });
    }

    if (status === 'pending') {
      await clientManager.abortPendingClient(userId, explicitFresh ? 'User requested fresh QR' : 'User clicked Connect');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const hasStoredSession = await clientManager.canRecoverSession(userId);

    if (explicitFresh) {
      await clientManager.cleanupLocalAuthArtifacts(userId);
    }

    await clientManager.createClient(
      userId,
      (qrImage) => {
        console.log(`📨 Sending QR to user ${userIdStr} via WebSocket (image size: ${qrImage?.length || 0} bytes)`);
        const sent = sendToUser(userIdStr, { type: 'qr', qr: qrImage });
        console.log(`${sent ? '✅' : '⚠️'} QR message ${sent ? 'sent' : 'buffered'} for WebSocket delivery`);
      },
      () => {
        console.log(`📨 Sending ready status to user ${userIdStr}`);
        sendToUser(userIdStr, { type: 'ready' });
      },
      (reason) => {
        console.log(`📨 Sending disconnected status to user ${userIdStr}: ${reason}`);
        sendToUser(userIdStr, { type: 'disconnected', reason });
      },
      { freshAuth: explicitFresh, suppressQrNotification: false }
    );

    const responseStatus = clientManager.getStatus(userId);
    const qr = getLatestQr(userIdStr);
    const message = hasStoredSession && !explicitFresh
      ? 'Restoring WhatsApp session...'
      : 'WhatsApp initializing. Scan QR.';

    res.json({
      message,
      status: responseStatus || 'pending',
      hasStoredSession: hasStoredSession && !explicitFresh,
      qr: qr || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getWhatsAppStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const status = clientManager.getStatus(userId);
    const session = await Session.findOne({ userId });
    const recoverable = await clientManager.canRecoverSession(userId);

    const client = clientManager.getClient(userId);
    let clientReady = false;

    if (client && status === 'connected') {
      clientReady = typeof client.sendMessage === 'function';
    }

    const qr = status === 'pending' ? getLatestQr(userId) : null;

    res.json({
      status: clientReady ? 'connected' : status,
      isActive: session?.isActive || false,
      hasStoredSession: recoverable,
      lastSeen: session?.lastSeen || null,
      clientReady,
      qr: qr || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const disconnectWhatsApp = async (req, res) => {
  try {
    clearLatestQr(req.user._id);
    await clientManager.disconnectClient(req.user._id);
    res.json({ message: 'WhatsApp disconnected successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const sendBulkMessages = async (req, res) => {
  try {
    const { numbers, message } = req.body;
    const userId = req.user._id;
    const sendToUser = req.app.get('sendToUser');

    const client = clientManager.getClient(userId);
    if (!client) {
      return res.status(400).json({ error: 'WhatsApp not connected. Please scan QR again.' });
    }

    // Log detailed client info for debugging
    console.log(`\n📋 Client check for user ${userId}:`);
    console.log(`   - sendMessage available: ${typeof client.sendMessage}`);
    console.log(`   - Client constructor: ${client.constructor.name}`);
    console.log(`   - Client methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(client)).filter(m => typeof client[m] === 'function').slice(0, 10).join(', ')}`);

    // Wait for client to be fully ready (max 5 seconds)
    let attempts = 0;
    while (!client.sendMessage && attempts < 10) {
      console.log(`⏳ Waiting for client to be ready... (attempt ${attempts + 1}/10)`);
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    // Verify client is actually ready and has sendMessage method
    if (!client.sendMessage || typeof client.sendMessage !== 'function') {
      console.error(`❌ Client sendMessage not available after waiting for user ${userId}`);
      console.error(`   Final check - typeof sendMessage: ${typeof client.sendMessage}`);
      return res.status(400).json({ error: 'WhatsApp client not fully initialized. Please scan QR code again.' });
    }

    // Additional checks for client health
    try {
      // Check if browser page is still open
      if (client.pupPage) {
        if (typeof client.pupPage.isClosed === 'function' && client.pupPage.isClosed()) {
          console.warn(`Browser page closed for user ${userId}`);
          clientManager.disconnectClient(userId);
          return res.status(400).json({ error: 'WhatsApp browser connection lost. Reconnecting...' });
        }
      }

      // Check if client is actually connected by checking internal state
      if (!client.pupBrowser || client.pupBrowser.isClosed && client.pupBrowser.isClosed()) {
        console.warn(`Browser instance closed for user ${userId}`);
        clientManager.disconnectClient(userId);
        return res.status(400).json({ error: 'WhatsApp browser crashed. Please reconnect.' });
      }
    } catch (err) {
      console.warn(`Error during pre-send health check for user ${userId}:`, err.message);
    }

    // Respond immediately — progress via WebSocket
    res.json({ message: 'Sending started', total: numbers.length });

    // Run in background with error handling
    (async () => {
      try {
        console.log(`Starting message send for user ${userId} to ${numbers.length} numbers`);
        await sendMessages(client, userId, numbers, message, (progress) => {
          sendToUser(userId.toString(), { type: 'progress', ...progress });
        });

        // Notify frontend when all done
        console.log(`Message send completed for user ${userId}`);
        sendToUser(userId.toString(), { type: 'sendingComplete' });
      } catch (err) {
        console.error('Background send error for user', userId, ':', err);
        sendToUser(userId.toString(), {
          type: 'sendingError',
          error: err.message
        });
      }
    })().catch(err => {
      console.error('Uncaught error in background send:', err);
    });

  } catch (err) {
    console.error('Send messages error:', err);
    res.status(500).json({ error: err.message });
  }
};

const sendBulkMessagesViaApiKey = async (req, res) => {
  try {
    const { numbers, message } = req.body;
    const apiKey = req.apiKey;
    const apiUser = req.apiUser;

    const client = clientManager.getClient(apiUser._id);
    if (!client) {
      return res.status(400).json({ error: 'WhatsApp not connected. Please connect first via dashboard.' });
    }

    if (!client.sendMessage || typeof client.sendMessage !== 'function') {
      return res.status(400).json({ error: 'WhatsApp client not ready. Please scan QR code.' });
    }

    res.json({ message: 'Sending started', total: numbers.length });

    (async () => {
      try {
        await sendMessages(client, apiUser._id, numbers, message, () => {});
        await trackUsage(apiKey._id, numbers.length);
        console.log(`API key ${apiKey._id} used to send ${numbers.length} messages`);
      } catch (err) {
        console.error('Background send error via API key:', err);
      }
    })().catch(err => {
      console.error('Uncaught error in background send:', err);
    });

  } catch (err) {
    console.error('Send via API key error:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sendBulkMessages,
  sendBulkMessagesViaApiKey
};
