const { validationResult } = require('express-validator');
const { getOrCreateBusinessProfile } = require('../utils/businessProfile');
const { DEFAULT_FOOTER_SEPARATOR } = require('../models/BusinessProfile');

const getProfile = async (req, res) => {
  try {
    const profile = await getOrCreateBusinessProfile(req.user._id);
    res.json({ profile });
  } catch (err) {
    console.error('Get business profile failed:', err.message);
    res.status(500).json({ error: 'Failed to load business profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { businessName, footerText, footerEnabled, footerSeparator } = req.body;
    const updates = {};

    if (businessName !== undefined) {
      updates.businessName = String(businessName).trim().slice(0, 120);
    }

    if (footerText !== undefined) {
      updates.footerText = String(footerText).trim().slice(0, 200);
    }

    if (footerEnabled !== undefined) {
      updates.footerEnabled = Boolean(footerEnabled);
    }

    if (footerSeparator !== undefined) {
      const separator = String(footerSeparator).trim().slice(0, 40);
      updates.footerSeparator = separator || DEFAULT_FOOTER_SEPARATOR;
    }

    const profile = await getOrCreateBusinessProfile(req.user._id);

    Object.assign(profile, updates);
    await profile.save();

    res.json({ profile });
  } catch (err) {
    console.error('Update business profile failed:', err.message);
    res.status(500).json({ error: 'Failed to update business profile' });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
