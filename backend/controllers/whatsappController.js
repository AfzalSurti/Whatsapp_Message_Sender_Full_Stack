const clientManager = require('../services/clientManager');
const { sendMessages } = require('../services/sender');
const Session = require('../models/Session');

const connectWhatsApp = async (req, res) => {
  try {
    const userId = req.user._id;
    const sendToUser = req.app.get('sendToUser');
    const status = clientManager.getStatus(userId);

    if (status === 'connected') {
      return res.json({ message: 'Already connected', status: 'connected' });
    }

    await clientManager.createClient(
      userId,
      (qrImage) => {
        // Send QR image to frontend via WebSocket
        sendToUser(userId.toString(), { type: 'qr', qr: qrImage });
      },
      () => {
        // Send connected status
        sendToUser(userId.toString(), { type: 'ready' });
      },
      (reason) => {
        // Send disconnected status
        sendToUser(userId.toString(), { type: 'disconnected', reason });
      }
    );

    res.json({ message: 'WhatsApp initializing. Scan QR.', status: 'pending' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getWhatsAppStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const status = clientManager.getStatus(userId);
    const session = await Session.findOne({ userId });

    res.json({
      status,
      isActive: session?.isActive || false,
      lastSeen: session?.lastSeen || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const disconnectWhatsApp = async (req, res) => {
  try {
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

    if (!numbers || !numbers.length) {
      return res.status(400).json({ error: 'No numbers provided' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const client = clientManager.getClient(userId);
    if (!client) {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    // Respond immediately — progress via WebSocket
    res.json({ message: 'Sending started', total: numbers.length });

    // Run in background
    await sendMessages(client, userId, numbers, message, (progress) => {
      sendToUser(userId.toString(), { type: 'progress', ...progress });
    });

    // Notify frontend when all done
    sendToUser(userId.toString(), { type: 'sendingComplete' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sendBulkMessages
};