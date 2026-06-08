const express = require('express');
require('dotenv').config();
require('./config/puppeteerEnv');
const fs = require('fs');
const http = require('http');           // needed to share server with WebSocket
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

// ─── RATE LIMITING ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
app.use('/api', limiter);
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
app.use('/api/ai-templates', require('./routes/aiTemplates'));
app.use('/api/auto-reply', require('./routes/autoReply'));

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WA Sender API is running',
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
  if (err?.code === 'ENOENT' && String(err?.path || '').includes('RemoteAuth')) {
    console.warn('RemoteAuth file access warning:', err.message);
    return;
  }
  console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  const message = reason?.message || String(reason || '');
  const reasonPath = String(reason?.path || '');

  if (
    reason?.code === 'ENOENT' &&
    (reasonPath.includes('RemoteAuth') || reasonPath.includes('.wwebjs_auth'))
  ) {
    console.warn('RemoteAuth backup warning (session still active):', message);
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

  if (process.platform === 'linux') {
    const { resolveChromeExecutable } = require('./config/puppeteerEnv');
    const chromePath = resolveChromeExecutable();
    console.log(`Puppeteer cache: ${process.env.PUPPETEER_CACHE_DIR}`);
    console.log(`Chrome executable: ${chromePath || 'NOT FOUND — run node scripts/ensure-chrome.js during build'}`);
  }

  // Recover active sessions after startup (delay longer on Render while Chrome warms up)
  const recoveryDelayMs =
    process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' ? 10000 : 2000;

  setTimeout(() => {
    recoverSessions(sendToUser);

    // Start campaign scheduler after clientManager is ready
    startScheduler(sendMessages, clientManager);
    console.log('📅 Campaign scheduler started');
  }, recoveryDelayMs);
});
