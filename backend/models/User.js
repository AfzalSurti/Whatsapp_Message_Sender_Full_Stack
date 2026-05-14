const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,                          // removes extra spaces
      minlength: [2, 'Name must be at least 2 characters']
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,                        // no duplicate emails
      lowercase: true,                     // always store as lowercase
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },

    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      // not required — OAuth users have no password
    },

    googleId: {
      type: String,
      default: null                        // only set for Google OAuth users
    },

    avatar: {
      type: String,
      default: null                        // Google profile picture URL
    },

    authProvider: {
      type: String,
      enum: ['local', 'google'],           // only these two values allowed
      default: 'local'
    },

    isVerified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true                       // auto adds createdAt and updatedAt
  }
);

// ─── HASH PASSWORD BEFORE SAVING ──────────────────────────────
// This runs automatically before every .save() call
// Only runs if password was changed — prevents double hashing
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();

  // bcrypt salt rounds — 12 is production standard
  // higher = more secure but slower
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── METHOD: Compare password ──────────────────────────────────
// Called during login to verify entered password
// Returns true if match, false if not
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ─── METHOD: Return user without password ─────────────────────
// Never send password to frontend — even hashed
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;  // remove password from response
  delete user.googleId;  // remove sensitive OAuth data
  return user;
};

module.exports = mongoose.model('User', UserSchema);