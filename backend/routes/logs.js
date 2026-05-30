const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getLogs, getCampaigns, getLiveFeed } = require('../controllers/logsController');

router.get('/', protect, getLogs);
router.get('/campaigns', protect, getCampaigns);
router.get('/live-feed', protect, getLiveFeed);

module.exports = router;