const express = require('express');
require('dotenv').config();
const http = require('http');           // needed to share server with WebSocket
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');

const connectDB = require('./config/db');
const { setupWebSocket, sendToUser, getWsClients } = require('./services/websocket');
const { recoverSessions } = require('./services/clientManager');
const verifyToken = require('./utils/verifyToken');

const app = express();

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
  message: { error: 'Too many requests. Please try again later.' }
});

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
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
    error: err.message || 'Internal server error'
  });
});

// ─── HANDLE UNCAUGHT EXCEPTIONS ────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  // Don't exit - try to keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - try to keep server running
});

// ─── SETUP WEBSOCKET ──────────────────────────────────────────
// Must be after server created — attaches to same HTTP server
setupWebSocket(server, verifyToken);

// ─── START SERVER ─────────────────────────────────────────────
// Use server.listen not app.listen
// server handles both HTTP and WebSocket
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // Recover active sessions from database after a short delay
  setTimeout(() => {
    recoverSessions(sendToUser);
  }, 2000);
});
