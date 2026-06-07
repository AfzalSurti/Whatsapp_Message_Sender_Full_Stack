const { validationResult } = require('express-validator');
const AutoReplyConfig = require('../models/AutoReplyConfig');
const AutoReplyLog = require('../models/AutoReplyLog');
const clientManager = require('../services/clientManager');
const {
  isChatId,
  fetchWhatsAppContacts,
  normalizePhoneValue
} = require('../utils/whatsappChat');

const getOrCreateConfig = async (userId) => {
  let config = await AutoReplyConfig.findOne({ userId });

  if (!config) {
    config = await AutoReplyConfig.create({ userId });
  }

  return config;
};

const normalizeSelectedContacts = (contacts = []) => {
  if (!Array.isArray(contacts)) {
    return { valid: false, error: 'selectedContacts must be an array' };
  }

  const normalized = [];

  for (const raw of contacts) {
    const value = String(raw || '').trim();
    if (!value) continue;

    if (isChatId(value)) {
      if (!normalized.includes(value)) normalized.push(value);
      continue;
    }

    const parsed = normalizePhoneValue(value);
    if (!parsed) {
      return { valid: false, error: `Invalid phone number: ${value}` };
    }

    if (!normalized.includes(parsed)) {
      normalized.push(parsed);
    }
  }

  return { valid: true, contacts: normalized };
};

const getConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig(req.user._id);
    res.json({ config });
  } catch (err) {
    console.error('Get auto-reply config failed:', err.message);
    res.status(500).json({ error: 'Failed to load auto-reply settings' });
  }
};

const updateConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { isEnabled, mode, selectedContacts, systemPrompt, delay } = req.body;
    const updates = {};

    if (typeof isEnabled === 'boolean') updates.isEnabled = isEnabled;
    if (mode !== undefined) updates.mode = mode;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
    if (delay !== undefined) updates.delay = delay;

    if (selectedContacts !== undefined) {
      const normalized = normalizeSelectedContacts(selectedContacts);
      if (!normalized.valid) {
        return res.status(400).json({ error: normalized.error });
      }
      updates.selectedContacts = normalized.contacts;
    }

    const config = await AutoReplyConfig.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ config });
  } catch (err) {
    console.error('Update auto-reply config failed:', err.message);
    res.status(500).json({ error: 'Failed to update auto-reply settings' });
  }
};

const getLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };

    if (req.query.contactPhone) {
      filter.contactPhone = String(req.query.contactPhone).trim();
    }

    const [logs, total] = await Promise.all([
      AutoReplyLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AutoReplyLog.countDocuments(filter)
    ]);

    res.json({
      logs,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error('Get auto-reply logs failed:', err.message);
    res.status(500).json({ error: 'Failed to load auto-reply logs' });
  }
};

const getContacts = async (req, res) => {
  try {
    const contacts = await AutoReplyLog.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$contactPhone',
          contactName: { $last: '$contactName' },
          lastMessageAt: { $max: '$createdAt' },
          messageCount: { $sum: 1 }
        }
      },
      { $sort: { lastMessageAt: -1 } },
      {
        $project: {
          _id: 0,
          contactPhone: '$_id',
          contactName: 1,
          lastMessageAt: 1,
          messageCount: 1
        }
      }
    ]);

    res.json({ contacts, total: contacts.length });
  } catch (err) {
    console.error('Get auto-reply contacts failed:', err.message);
    res.status(500).json({ error: 'Failed to load auto-reply contacts' });
  }
};

const deleteContactLogs = async (req, res) => {
  try {
    const contactPhone = String(req.query.contactPhone || '').trim();
    if (!contactPhone) {
      return res.status(400).json({ error: 'contactPhone is required' });
    }

    const result = await AutoReplyLog.deleteMany({
      userId: req.user._id,
      contactPhone
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'No conversation history found for this contact' });
    }

    res.json({
      message: 'Contact conversation history deleted',
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Delete auto-reply contact logs failed:', err.message);
    res.status(500).json({ error: 'Failed to delete contact history' });
  }
};

const getWhatsAppContacts = async (req, res) => {
  try {
    const userId = req.user._id;
    let client = clientManager.getClient(userId);

    if (!clientManager.isClientReady(userId)) {
      client = await clientManager.waitForClientReady(userId, 20000);
    }

    if (!client || !clientManager.isClientReady(userId)) {
      return res.status(400).json({
        error: 'WhatsApp not connected. Connect first, then click Refresh.'
      });
    }

    const contacts = await Promise.race([
      fetchWhatsAppContacts(client),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Loading WhatsApp contacts timed out')), 35000);
      })
    ]);

    res.json({ contacts });
  } catch (err) {
    console.error('Get WhatsApp contacts failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to load WhatsApp contacts' });
  }
};

const deleteLog = async (req, res) => {
  try {
    const log = await AutoReplyLog.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!log) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    res.json({ message: 'Log entry deleted' });
  } catch (err) {
    console.error('Delete auto-reply log failed:', err.message);
    res.status(500).json({ error: 'Failed to delete log entry' });
  }
};

const clearLogs = async (req, res) => {
  try {
    const result = await AutoReplyLog.deleteMany({ userId: req.user._id });
    res.json({ message: 'All auto-reply logs cleared', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Clear auto-reply logs failed:', err.message);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
};

module.exports = {
  getConfig,
  updateConfig,
  getLogs,
  getContacts,
  getWhatsAppContacts,
  deleteLog,
  deleteContactLogs,
  clearLogs
};
