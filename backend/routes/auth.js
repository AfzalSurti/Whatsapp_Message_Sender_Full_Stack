const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const passport = require('passport');
const {
  signup,
  login,
  getMe,
  updateProfile,
  googleCallback,
  logout
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const requireGoogleOAuth = (req, res, next) => {
  if (!passport._strategy('google')) {
    return res.status(503).json({
      error: 'Google OAuth is not configured on the server.'
    });
  }

  next();
};

// Validation rules for signup
const signupValidation = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
  body('email').isEmail().normalizeEmail().isLength({ max: 254 }).withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be 6-128 characters')
];

// Validation rules for login
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().isLength({ max: 128 }).withMessage('Password is required')
];

// ─── LOCAL AUTH ───────────────────────────────────────────────
router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);
router.patch(
  '/profile',
  protect,
  body('messageFooter').optional().trim().isLength({ max: 80 }).withMessage('Footer must be 80 characters or less'),
  body('messageFooterEnabled').optional().isBoolean().withMessage('messageFooterEnabled must be true or false'),
  body('schedulerAlertPhone').optional().trim(),
  updateProfile
);
router.post('/logout', protect, logout);

// ─── GOOGLE OAUTH ─────────────────────────────────────────────
// Step 1 — redirect user to Google login page
router.get('/google',
  requireGoogleOAuth,
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Step 2 — Google redirects back here after login
router.get('/google/callback',
  requireGoogleOAuth,
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
    session: false    // we use JWT not sessions
  }),
  googleCallback      // sends JWT token to frontend
);

module.exports = router;
