const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const passport = require('passport');
const {
  signup,
  login,
  getMe,
  googleCallback
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
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

// Validation rules for login
const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// ─── LOCAL AUTH ───────────────────────────────────────────────
router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);          // get logged in user

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
