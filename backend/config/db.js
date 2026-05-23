const mongoose = require('mongoose');

/**
 * Connect to MongoDB with retry/backoff.
 * This avoids crashing the whole process on transient DNS/network errors.
 */
const connectDB = async (opts = {}) => {
    const maxAttempts = opts.maxAttempts || 10;
    const baseDelay = opts.baseDelayMs || 2000;

    let attempt = 0;

    const tryConnect = async () => {
        attempt += 1;
        try {
            const conn = await mongoose.connect(process.env.MONGODB_URI, { keepAlive: true });
            console.log(`MongoDB Connected: ${conn.connection.host}`);
            return;
        } catch (err) {
            console.error(`MongoDb connection attempt ${attempt} failed: ${err.message}`);

            if (attempt >= maxAttempts) {
                console.error(`MongoDb: reached ${maxAttempts} attempts — will keep retrying in background but will not exit.`);
            }

            // Exponential backoff with jitter
            const jitter = Math.floor(Math.random() * 1000);
            const delay = Math.min(baseDelay * Math.pow(2, Math.max(0, attempt - 1)), 30000) + jitter;

            await new Promise(resolve => setTimeout(resolve, delay));
            return tryConnect();
        }
    };

    // Start connecting but don't throw — keep retrying until success in background.
    tryConnect().catch(err => {
        console.error('Unexpected error in MongoDB connect loop:', err.message);
    });
};

module.exports = connectDB;
