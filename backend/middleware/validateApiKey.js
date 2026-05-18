const ApiKey = require('../models/ApiKey');
const User = require('../models/User');

/**
 * Middleware to validate API key from x-api-key header
 * Attaches req.apiKey (ApiKey document) and req.apiUser (User document) to request
 */
const validateApiKey = async (req, res, next) => {
  try {
    const key = req.headers['x-api-key'];

    if (!key) {
      return res.status(401).json({ error: 'Missing API key. Provide x-api-key header.' });
    }

    // Find active API key
    const apiKey = await ApiKey.findOne({ key, isActive: true });

    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid or inactive API key.' });
    }

    // Check monthly limit
    if (apiKey.monthlyUsage >= apiKey.monthlyLimit) {
      return res.status(429).json({
        error: 'Monthly usage limit exceeded',
        limit: apiKey.monthlyLimit,
        used: apiKey.monthlyUsage
      });
    }

    // Find user
    const user = await User.findById(apiKey.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    // Attach to request
    req.apiKey = apiKey;
    req.apiUser = user;

    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({ error: 'API key validation failed' });
  }
};

module.exports = { validateApiKey };
