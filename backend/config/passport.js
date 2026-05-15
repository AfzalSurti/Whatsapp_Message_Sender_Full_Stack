const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Existing Google user — return them
          return done(null, user);
        }

        // Check if email already registered locally
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Link Google to existing local account
          user.googleId = profile.id;
          user.authProvider = 'google';
          user.avatar = profile.photos[0].value;
          await user.save();
          return done(null, user);
        }

        // Brand new user — create account
        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          avatar: profile.photos[0].value,
          authProvider: 'google',
          isVerified: true   // Google accounts are pre-verified
        });

        return done(null, user);

      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;