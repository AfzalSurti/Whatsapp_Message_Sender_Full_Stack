const MessageLog = require('../models/MessageLog');
const Campaign = require('../models/Campaign');

const formatRelativeTime = (date) => {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const getFeedTone = (status) => {
  if (status === 'sent' || status === 'completed' || status === 'running') {
    return '#25D366';
  }

  if (status === 'failed') {
    return '#f97316';
  }

  if (status === 'skipped' || status === 'pending') {
    return '#8b5cf6';
  }

  return '#3b82f6';
};

// ─── GET MESSAGE LOGS ─────────────────────────────────────────
const getLogs = async (req, res) => {
  try {
    const pageNum = Math.max(1, Math.min(Number(req.query.page) || 1, 10000));
    const limitNum = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));
    const { status } = req.query;

    const filter = { userId: req.user._id };
    if (status && ['sent', 'failed', 'skipped'].includes(status)) {
      filter.status = status;
    }

    const logs = await MessageLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await MessageLog.countDocuments(filter);

    res.json({
      logs,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to load message logs' });
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

// ─── GET LIVE FEED ───────────────────────────────────────────
const getLiveFeed = async (req, res) => {
  try {
    const [campaigns, logs] = await Promise.all([
      Campaign.find({ userId: req.user._id })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(8)
        .lean(),
      MessageLog.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(14)
        .populate('campaignId', 'name totalNumbers sent failed skipped status createdAt updatedAt')
        .lean()
    ]);

    const liveFeed = [];

    logs.forEach((log) => {
      const campaignName = log.campaignId?.name || 'Bulk send';
      const status = log.status || 'sent';
      const tone = getFeedTone(status);
      let title = '';
      let subtitle = '';

      if (status === 'sent') {
        title = `Message sent to ${log.number}`;
        subtitle = `Campaign: ${campaignName}`;
      } else if (status === 'failed') {
        title = `Message failed for ${log.number}`;
        subtitle = log.failReason || `Campaign: ${campaignName}`;
      } else {
        title = `Skipped ${log.number}`;
        subtitle = log.failReason || `Campaign: ${campaignName}`;
      }

      liveFeed.push({
        id: `log-${log._id}`,
        type: status,
        title,
        subtitle,
        timeLabel: formatRelativeTime(log.createdAt),
        timestamp: log.createdAt,
        color: tone
      });
    });

    campaigns.forEach((campaign) => {
      const totalNumbers = campaign.totalNumbers || 0;
      const finishedCount = (campaign.sent || 0) + (campaign.failed || 0) + (campaign.skipped || 0);
      const progress = totalNumbers > 0 ? Math.min(100, Math.round((finishedCount / totalNumbers) * 100)) : 0;
      const status = campaign.status || 'pending';
      const tone = getFeedTone(status);
      const statusLabel =
        status === 'running' ? 'Live' :
        status === 'completed' ? 'Completed' :
        status === 'failed' ? 'Failed' :
        'Scheduled';

      liveFeed.push({
        id: `campaign-${campaign._id}`,
        type: status,
        title: campaign.name || 'Untitled Campaign',
        subtitle: `${campaign.sent || 0} sent · ${campaign.failed || 0} failed · ${campaign.skipped || 0} skipped`,
        timeLabel: formatRelativeTime(campaign.updatedAt || campaign.createdAt),
        timestamp: campaign.updatedAt || campaign.createdAt,
        color: tone,
        progress,
        statusLabel,
        sent: campaign.sent || 0,
        failed: campaign.failed || 0,
        skipped: campaign.skipped || 0,
        totalNumbers
      });
    });

    liveFeed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const campaignProgress = campaigns.map((campaign) => {
      const totalNumbers = campaign.totalNumbers || 0;
      const finishedCount = (campaign.sent || 0) + (campaign.failed || 0) + (campaign.skipped || 0);
      const progress = totalNumbers > 0 ? Math.min(100, Math.round((finishedCount / totalNumbers) * 100)) : 0;
      const status = campaign.status || 'pending';

      return {
        id: campaign._id,
        name: campaign.name || 'Untitled Campaign',
        status,
        statusLabel:
          status === 'running' ? 'Live' :
          status === 'completed' ? 'Completed' :
          status === 'failed' ? 'Failed' :
          'Scheduled',
        progress,
        sentLabel: campaign.sent || 0,
        totalLabel: totalNumbers || 0,
        failed: campaign.failed || 0,
        skipped: campaign.skipped || 0,
        updatedAt: campaign.updatedAt,
        color: getFeedTone(status)
      };
    });

    res.json({
      liveFeed: liveFeed.slice(0, 12),
      campaignProgress,
      summary: {
        totalCampaigns: campaigns.length,
        runningCampaigns: campaigns.filter((campaign) => campaign.status === 'running').length,
        completedCampaigns: campaigns.filter((campaign) => campaign.status === 'completed').length,
        recentActivity: liveFeed.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getLogs, getCampaigns, getLiveFeed };