const express = require('express');
require('dotenv').config();
const http = require('http');           // needed to share server with WebSocket
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');

const { createCorsOptions, logCorsConfig } = require('./config/cors');
const connectDB = require('./config/db');
const securityHeaders = require('./middleware/securityHeaders');
const { getSafeErrorMessage } = require('./utils/safeError');
const { setupWebSocket, sendToUser, getWsClients } = require('./services/websocket');
const { recoverSessions } = require('./services/clientManager');
const verifyToken = require('./utils/verifyToken');
const { startScheduler } = require('./services/scheduler');
const { sendMessages } = require('./services/sender');
const clientManager = require('./services/clientManager');

const app = express();

// Render / Vercel sit behind a reverse proxy — required for rate-limit + real client IP
app.set('trust proxy', 1);

// ─── CREATE HTTP SERVER ───────────────────────────────────────
// We need raw HTTP server to attach WebSocket on same port
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// ─── CONNECT DATABASE ─────────────────────────────────────────
connectDB();

const waitForMongoConnection = (timeoutMs = 20000) => {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      mongoose.connection.off('connected', onConnected);
      mongoose.connection.off('error', onError);
    };

    const done = (connected) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(connected);
    };

    const onConnected = () => done(true);
    const onError = () => done(false);

    mongoose.connection.once('connected', onConnected);
    mongoose.connection.once('error', onError);

    setTimeout(() => done(mongoose.connection.readyState === 1), timeoutMs);
  });
};

// ─── RATE LIMITING ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
});

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(securityHeaders);
app.use(cors(createCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
// app.use('/api', limiter);
app.use(passport.initialize());

// ─── ATTACH WS CLIENTS TO APP ────────────────────────────────
// Makes wsClients accessible in controllers via req.app.get('wsClients')
app.set('wsClients', getWsClients());
app.set('sendToUser', sendToUser);

// ─── ROUTES ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/ai',require('./routes/ai'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/scheduled', require('./routes/scheduled'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/business-profile', require('./routes/businessProfile'));
app.use('/api/ai-templates', require('./routes/aiTemplates'));
app.use('/api/auto-reply', require('./routes/autoReply'));

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WA Sender API is running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ─── 404 HANDLER ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error: getSafeErrorMessage(err)
  });
});

// ─── HANDLE UNCAUGHT EXCEPTIONS ────────────────────────────────
process.on('uncaughtException', (err) => {
  if (err?.code === 'ENOENT' && String(err?.path || '').includes('baileys_auth')) {
    console.warn('WhatsApp local session file warning:', err.message);
    return;
  }
  console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  const message = reason?.message || String(reason || '');
  const reasonPath = String(reason?.path || '');

  if (
    reason?.code === 'ENOENT' &&
    reasonPath.includes('baileys_auth')
  ) {
    console.warn('WhatsApp local session warning:', message);
    return;
  }

  if (reason?.code === 'EBUSY' && reasonPath.includes('baileys_auth')) {
    console.warn('WhatsApp session folder locked during cleanup:', message);
    return;
  }

  console.error('💥 Unhandled Rejection:', reason);
});

// ─── SETUP WEBSOCKET ──────────────────────────────────────────
// Must be after server created — attaches to same HTTP server
setupWebSocket(server, verifyToken);

// ─── START SERVER ─────────────────────────────────────────────
// Use server.listen not app.listen
// server handles both HTTP and WebSocket
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  logCorsConfig();

  const recoveryDelayMs =
    process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'
      ? 5000
      : 2000;

  setTimeout(async () => {
    const mongoReady = await waitForMongoConnection(30000);
    if (!mongoReady) {
      console.warn('⚠️ MongoDB not connected yet; skipping session recovery and scheduler startup for now.');
      return;
    }

    recoverSessions(sendToUser);

    // Start campaign scheduler after MongoDB is connected
    startScheduler(sendMessages, clientManager);
    console.log('📅 Campaign scheduler started');
  }, recoveryDelayMs);
});
