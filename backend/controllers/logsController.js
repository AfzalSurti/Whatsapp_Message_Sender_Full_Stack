const MessageLog = require('../models/MessageLog');
const Campaign = require('../models/Campaign');

// ─── GET MESSAGE LOGS ─────────────────────────────────────────
const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;

    // Build filter — only this user's logs
    const filter = { userId: req.user._id };
    if (status) filter.status = status; // filter by sent/failed/skipped

    const logs = await MessageLog.find(filter)
      .sort({ createdAt: -1 })           // newest first
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MessageLog.countDocuments(filter);

    res.json({
      logs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET CAMPAIGNS ────────────────────────────────────────────
const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getLogs, getCampaigns };