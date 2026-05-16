const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getLogs, getCampaigns } = require('../controllers/logsController');

router.get('/', protect, getLogs);
router.get('/campaigns', protect, getCampaigns);

module.exports = router;