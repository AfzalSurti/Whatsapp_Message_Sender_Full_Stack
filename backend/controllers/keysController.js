const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');

/**
 * Generate new API key for user
 * Max 5 keys per user
 */
const generateKey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name } = req.body;

    // Check user doesn't have too many keys
    const keyCount = await ApiKey.countDocuments({ userId, isActive: true });
    if (keyCount >= 5) {
      return res.status(400).json({ error: 'Maximum 5 API keys allowed per user' });
    }

    // Generate key: "wsa_live_" + 32 hex characters
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const key = `wsa_live_${randomBytes}`;

    // Create API key
    const apiKey = await ApiKey.create({
      userId,
      key,
      name: name || 'My API Key'
    });

    res.status(201).json({
      key,
      name: apiKey.name,
      createdAt: apiKey.createdAt
    });
  } catch (error) {
    console.error('Generate key error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all API keys for user (masked)
 */
const getKeys = async (req, res) => {
  try {
    const userId = req.user._id;

    const keys = await ApiKey.find({ userId }).sort({ createdAt: -1 });

    // Mask full keys - show first 12 and last 4 chars
    const maskedKeys = keys.map((k) => {
      const fullKey = k.key;
      const maskedKey = `${fullKey.substring(0, 12)}****...${fullKey.substring(fullKey.length - 4)}`;

      return {
        id: k._id,
        maskedKey,
        name: k.name,
        usageCount: k.usageCount,
        monthlyUsage: k.monthlyUsage,
        monthlyLimit: k.monthlyLimit,
        lastUsed: k.lastUsed,
        isActive: k.isActive,
        createdAt: k.createdAt
      };
    });

    res.json({ keys: maskedKeys });
  } catch (error) {
    console.error('Get keys error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get full key (one-time reveal)
 * Only returns full key once to the user
 */
const getFullKey = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const apiKey = await ApiKey.findOne({ _id: id, userId });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ key: apiKey.key });
  } catch (error) {
    console.error('Get full key error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Soft delete API key (set isActive to false)
 */
const deleteKey = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const apiKey = await ApiKey.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Delete key error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get usage statistics for a key
 */
const getKeyStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const apiKey = await ApiKey.findOne({ _id: id, userId });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      usageCount: apiKey.usageCount,
      monthlyUsage: apiKey.monthlyUsage,
      monthlyLimit: apiKey.monthlyLimit,
      lastUsed: apiKey.lastUsed
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Increment usage for API key (called when key is used to send messages)
 * Tracks both total usage and monthly usage
 */
const trackUsage = async (keyId, count = 1) => {
  try {
    const apiKey = await ApiKey.findById(keyId);
    if (!apiKey) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastUsedMonth = apiKey.lastUsed ? `${apiKey.lastUsed.getFullYear()}-${String(apiKey.lastUsed.getMonth() + 1).padStart(2, '0')}` : null;

    const updateData = {
      $inc: { usageCount: count },
      lastUsed: now
    };

    // Reset monthly usage if month has changed
    if (lastUsedMonth !== currentMonth) {
      updateData.$set = { monthlyUsage: count, monthlyUsageMonth: currentMonth };
    } else {
      updateData.$inc.monthlyUsage = count;
    }

    await ApiKey.findByIdAndUpdate(keyId, updateData);
  } catch (error) {
    console.error('Track usage error:', error);
  }
};

module.exports = {
  generateKey,
  getKeys,
  getFullKey,
  deleteKey,
  getKeyStats,
  trackUsage
};
