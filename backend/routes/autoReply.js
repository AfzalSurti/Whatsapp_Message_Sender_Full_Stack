const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  getConfig,
  updateConfig,
  getLogs,
  getContacts,
  deleteLog,
  clearLogs
} = require('../controllers/autoReplyController');

const updateValidation = [
  body('isEnabled').optional().isBoolean().withMessage('isEnabled must be a boolean'),
  body('mode').optional().isIn(['all', 'selected']).withMessage('mode must be all or selected'),
  body('selectedContacts').optional().isArray().withMessage('selectedContacts must be an array'),
  body('systemPrompt')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('systemPrompt must be 1-2000 characters'),
  body('delay')
    .optional()
    .isInt({ min: 1000, max: 10000 })
    .withMessage('delay must be between 1000 and 10000 ms')
];

const logsQueryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('contactPhone').optional().isString().trim()
];

router.get('/config', protect, getConfig);
router.put('/config', protect, updateValidation, updateConfig);
router.get('/logs', protect, logsQueryValidation, getLogs);
router.get('/contacts', protect, getContacts);
router.delete('/logs/:id', protect, param('id').isMongoId(), deleteLog);
router.delete('/logs', protect, clearLogs);

module.exports = router;
