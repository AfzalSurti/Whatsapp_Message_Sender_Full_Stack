const express = require('express');
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  getTemplates,
  getExampleTemplate,
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
  body('description')
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage('Description is required'),
  body('aiAdvice').optional().trim().isLength({ max: 4000 }),
  body('priority').optional().isInt({ min: 1, max: 100 }),
  body('isActive').optional().isBoolean(),
  body('customFields').optional().isArray(),
  body('exampleConversations').optional().isArray(),
  body('sharedDocuments').optional().isArray()
];

router.get('/example', protect, getExampleTemplate);
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
