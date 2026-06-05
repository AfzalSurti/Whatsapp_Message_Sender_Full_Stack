const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { protect } = require('../middleware/auth');
const { getLogs, getCampaigns, getLiveFeed } = require('../controllers/logsController');

const logsQueryValidation = [
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['sent', 'failed', 'skipped'])
];

router.get('/', protect, logsQueryValidation, getLogs);
router.get('/campaigns', protect, getCampaigns);
router.get('/live-feed', protect, getLiveFeed);

module.exports = router;
