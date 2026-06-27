const express = require('express');
require('dotenv').config();
const http = require('http');
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

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

connectDB();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
});

app.use(securityHeaders);
app.use(cors(createCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
// app.use('/api', limiter);
app.use(passport.initialize());

app.set('wsClients', getWsClients());
app.set('sendToUser', sendToUser);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/ai-templates', require('./routes/aiTemplates'));
app.use('/api/auto-reply', require('./routes/autoReply'));
app.use('/api/business-profile', require('./routes/businessProfile'));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WA Auto Reply API is running',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error: getSafeErrorMessage(err)
  });
});

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

  if (reason?.code === 'ENOENT' && reasonPath.includes('baileys_auth')) {
    console.warn('WhatsApp local session warning:', message);
    return;
  }

  if (reason?.code === 'EBUSY' && reasonPath.includes('baileys_auth')) {
    console.warn('WhatsApp session folder locked during cleanup:', message);
    return;
  }

  console.error('💥 Unhandled Rejection:', reason);
});

setupWebSocket(server, verifyToken);

server.listen(PORT, () => {
  console.log(`🚀 WA Auto Reply server running on http://localhost:${PORT}`);
  logCorsConfig();

  const recoveryDelayMs =
    process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'
      ? 5000
      : 2000;

  setTimeout(() => {
    recoverSessions(sendToUser);
    console.log('📱 WhatsApp session recovery started');
  }, recoveryDelayMs);
});
