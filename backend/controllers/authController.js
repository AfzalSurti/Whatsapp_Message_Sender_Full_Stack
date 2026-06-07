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
    const user = await User.create({ name, email, password });

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
  res.json({ user: req.user });
};

// ─── GOOGLE OAUTH CALLBACK ────────────────────────────────────
// Called after Google login succeeds
// Sends token to frontend via URL redirect
const googleCallback = (req, res) => {
  const token = generateToken(req.user._id);

  // Redirect to frontend with token in URL
  // Frontend extracts token and stores in localStorage
  res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
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

module.exports = { signup, login, getMe, googleCallback, logout };