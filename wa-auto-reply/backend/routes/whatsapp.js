const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp
} = require('../controllers/whatsappController');

router.post('/connect', protect, connectWhatsApp);
router.get('/status', protect, getWhatsAppStatus);
router.post('/disconnect', protect, disconnectWhatsApp);

module.exports = router;
