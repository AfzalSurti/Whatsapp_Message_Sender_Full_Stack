const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── PROTECT ROUTE MIDDLEWARE ──────────────────────────────────
// Add this to any route that needs authentication
// It checks the JWT token in the Authorization header
const protect = async (req, res, next) => {
  try {
    let token;

    // Token comes in header as: "Bearer eyJhbGci..."
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1]; // extract token
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized. No token.' });
    }

    // Verify token — throws error if invalid or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user from token's id — attach to request
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    next(); // move to next middleware or route handler

  } catch (error) {
    return res.status(401).json({ error: 'Not authorized. Invalid token.' });
  }
};

module.exports = { protect };