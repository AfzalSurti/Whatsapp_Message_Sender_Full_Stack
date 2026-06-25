const clientManager = require('../services/clientManager');
const Session = require('../models/Session');
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
        console.log(`📨 Sending QR to user ${userIdStr} via WebSocket`);
        sendToUser(userIdStr, { type: 'qr', qr: qrImage });
      },
      () => {
        sendToUser(userIdStr, { type: 'ready' });
      },
      (reason) => {
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

    res.json({
      status: clientReady ? 'connected' : status,
      isActive: session?.isActive || false,
      hasStoredSession: recoverable,
      restoring: status === 'pending' && recoverable,
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

module.exports = {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp
};
