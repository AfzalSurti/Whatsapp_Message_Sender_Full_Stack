const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { getSafeErrorMessage } = require('../utils/safeError');

// ─── GENERATE JWT TOKEN ────────────────────────────────────────
const generateToken = (id) => {
  return jwt.sign(
    { id },                          // payload — what we store in token
    process.env.JWT_SECRET,          // secret key
    { expiresIn: process.env.JWT_EXPIRES_IN } // expiry
  );
};

// ─── SIGNUP ───────────────────────────────────────────────────
const signup = async (req, res) => {
  try {
    // Check validation errors from express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Create user — password gets hashed automatically via pre-save hook
    const user = await User.create({ name, email, password, messageFooter: name.trim().slice(0, 80) });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({ token, user });

  } catch (error) {
    res.status(500).json({ error: getSafeErrorMessage(error) });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user — include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if user signed up with Google — no password set
    if (user.authProvider === 'google') {
      return res.status(400).json({
        error: 'This account uses Google login. Please sign in with Google.'
      });
    }

    // Compare entered password with hashed password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user._id);

    res.json({ token, user });

  } catch (error) {
    res.status(500).json({ error: getSafeErrorMessage(error) });
  }
};

// ─── GET ME ───────────────────────────────────────────────────
// Returns currently logged in user data
const getMe = async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.json({ user: req.user });
};

const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { messageFooter, messageFooterEnabled } = req.body;
    const updates = {};

    if (messageFooter !== undefined) {
      updates.messageFooter = String(messageFooter).trim().slice(0, 80);
    }

    if (messageFooterEnabled !== undefined) {
      updates.messageFooterEnabled = Boolean(messageFooterEnabled);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { returnDocument: 'after' }
    );

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: getSafeErrorMessage(error) });
  }
};

// ─── GOOGLE OAUTH CALLBACK ────────────────────────────────────
// Called after Google login succeeds
// Sends token to frontend via URL redirect
const googleCallback = (req, res) => {
  const token = generateToken(req.user._id);
  const userSnapshot = {
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    authProvider: req.user.authProvider || 'google'
  };
  const userParam = Buffer.from(JSON.stringify(userSnapshot)).toString('base64url');

  res.redirect(
    `${process.env.CLIENT_URL}/auth/callback?token=${token}&user=${encodeURIComponent(userParam)}`
  );
};

// ─── LOGOUT ───────────────────────────────────────────────────
// Disconnects WhatsApp and clears session on server
const logout = async (req, res) => {
  try {
    const clientManager = require('../services/clientManager');
    const userId = req.user._id;

    // Disconnect WhatsApp client and clear session
    await clientManager.clearWhatsAppSession(userId);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: getSafeErrorMessage(error) });
  }
};

module.exports = { signup, login, getMe, updateProfile, googleCallback, logout };