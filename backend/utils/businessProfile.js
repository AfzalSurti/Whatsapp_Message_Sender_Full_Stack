const BusinessProfile = require('../models/BusinessProfile');
const User = require('../models/User');
const { DEFAULT_FOOTER_SEPARATOR } = require('../models/BusinessProfile');

const getOrCreateBusinessProfile = async (userId) => {
  let profile = await BusinessProfile.findOne({ userId });

  if (profile) {
    return profile;
  }

  const user = await User.findById(userId).select('name messageFooter messageFooterEnabled').lean();

  profile = await BusinessProfile.create({
    userId,
    businessName: user?.name || '',
    footerText: user?.messageFooter || '',
    footerEnabled: false,
    footerSeparator: DEFAULT_FOOTER_SEPARATOR
  });

  return profile;
};

module.exports = {
  getOrCreateBusinessProfile
};
