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
      const session = await Session.findOne({ userId }).select('phoneNumber').lean();
      return res.json({
        message: 'Already connected',
        status: 'connected',
        phoneNumber: clientManager.getConnectedPhoneNumber(userId) || session?.phoneNumber || null
      });
    }

    if (status === 'pending' && explicitFresh) {
      await clientManager.abortPendingClient(userId, 'User requested fresh QR');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else if (status === 'pending') {
      const qr = getLatestQr(userIdStr);
      return res.json({
        message: 'WhatsApp session restore already in progress',
        status: 'pending',
        hasStoredSession: true,
        qr: qr || null
      });
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
        const phoneNumber = clientManager.getConnectedPhoneNumber(userId);
        sendToUser(userIdStr, { type: 'ready', phoneNumber });
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
    let status = clientManager.getStatus(userId);
    const session = await Session.findOne({ userId });
    const recoverable = await clientManager.canRecoverSession(userId);

    if (status === 'disconnected' && recoverable && !clientManager.isClientPending(userId)) {
      const sendToUser = req.app.get('sendToUser');
      clientManager.ensureClientConnected(userId, sendToUser).catch((err) => {
        console.error(`Background session restore failed for ${userId}:`, err.message);
      });
      status = clientManager.getStatus(userId);
    }

    const client = clientManager.getClient(userId);
    let clientReady = false;

    if (client && status === 'connected') {
      clientReady = typeof client.sendMessage === 'function';
    }

    const qr = status === 'pending' ? getLatestQr(userId) : null;
    const livePhone = clientReady ? clientManager.getConnectedPhoneNumber(userId) : null;

    res.json({
      status: clientReady ? 'connected' : status,
      isActive: session?.isActive || false,
      hasStoredSession: recoverable,
      restoring: status === 'pending' && recoverable,
      lastSeen: session?.lastSeen || null,
      phoneNumber: livePhone || session?.phoneNumber || null,
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

const getWhatsAppContacts = async (req, res) => {
  try {
    const userId = req.user._id;
    const forceRefresh = req.query.refresh === '1';

    const contacts = await clientManager.getPickerContacts(userId, {
      limit: 500,
      forceRefresh
    });

    res.set('Cache-Control', 'no-store');
    res.json({ contacts });
  } catch (err) {
    console.error('Get WhatsApp contacts failed:', err.message);
    const status = /not connected|timed out/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message || 'Failed to load WhatsApp contacts' });
  }
};

const sendBulkMessages = async (req, res) => {
  try {
    const { numbers, message } = req.body;
    const userId = req.user._id;
    const sendToUser = req.app.get('sendToUser');

    if (!clientManager.isClientReady(userId)) {
      const readyClient = await clientManager.waitForClientReady(userId, 5000);
      if (!readyClient) {
        return res.status(400).json({ error: 'WhatsApp not connected. Please scan QR again.' });
      }
    }

    const client = clientManager.getClient(userId);
    if (!client?.sendMessage) {
      return res.status(400).json({ error: 'WhatsApp client not ready. Please connect again.' });
    }

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
    if (!clientManager.isClientReady(apiUser._id)) {
      return res.status(400).json({ error: 'WhatsApp not connected. Please connect first via dashboard.' });
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
  getWhatsAppContacts,
  sendBulkMessages,
  sendBulkMessagesViaApiKey
};
