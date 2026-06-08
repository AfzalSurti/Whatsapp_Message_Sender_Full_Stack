const express = require('express');
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplate,
  getConversations,
  getConversation,
  deleteConversation,
  getLeads
} = require('../controllers/templateController');

const router = express.Router();

const templateValidation = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('intentDescription')
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage('Intent description is required'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('initialMessage').optional().trim().isLength({ max: 2000 }),
  body('aiInstructions').optional().trim().isLength({ max: 4000 }),
  body('knowledgeBase').optional().isLength({ max: 10000 }),
  body('escalationRules').optional().trim().isLength({ max: 2000 }),
  body('priority').optional().isInt({ min: 1, max: 100 }),
  body('isActive').optional().isBoolean(),
  body('triggerExamples').optional(),
  body('workflowSteps').optional().isArray(),
  body('leadFields').optional().isArray(),
  body('attachedDocuments').optional().isArray()
];

router.get('/conversations', protect, getConversations);
router.get('/conversations/:id', protect, param('id').isMongoId(), getConversation);
router.delete('/conversations/:id', protect, param('id').isMongoId(), deleteConversation);
router.get('/leads', protect, getLeads);

router.get('/', protect, getTemplates);
router.post('/', protect, templateValidation, createTemplate);
router.put('/:id', protect, param('id').isMongoId(), templateValidation, updateTemplate);
router.delete('/:id', protect, param('id').isMongoId(), deleteTemplate);
router.patch('/:id/toggle', protect, param('id').isMongoId(), toggleTemplate);

module.exports = router;
