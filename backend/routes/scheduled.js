const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  createCampaign,
  getCampaigns,
  getCampaign,
  cancelCampaign,
  deleteCampaign
} = require('../controllers/scheduledController');

const createValidation = [
  body('name').trim().optional(),
  body('message').optional().trim(),
  body('scheduledAt').isISO8601().withMessage('Invalid scheduled time format'),
  body('timezone').trim().optional(),
  body('groupIds').isArray().optional(),
  body('segmentTags').optional().isArray(),
  body('individualNumbers').isArray().optional(),
  body('templateId').optional().isMongoId().withMessage('Invalid template ID'),
  body('templateVariables').optional().isObject(),
  body('sendingSpeed').optional().trim(),
  body('recurrencePattern').optional().trim(),
  body('recurrenceStartDate').optional().isISO8601(),
  body('recurrenceEndDate').optional().isISO8601()
];

router.post('/', protect, createValidation, createCampaign);
router.get('/', protect, getCampaigns);
router.get('/:id', protect, param('id').isMongoId(), getCampaign);
router.patch('/:id/cancel', protect, param('id').isMongoId(), cancelCampaign);
router.delete('/:id', protect, param('id').isMongoId(), deleteCampaign);

module.exports = router;
